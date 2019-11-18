function drawing_init() {
    // Initializing socket
    let socket = io.connect("3.134.209.93");

    // Element binds
    let word_list_element = document.getElementById("word-list");
    let word_being_drawn_element = document.getElementById("word-being-drawn");
    let round_timer = document.getElementById("round-timer");
    let word_being_guessed_element = document.getElementById("word-being-guessed");

    //@note: Would support multiple rooms in the future, but for now, let's just assume there is one word
    let game = {
        started: false,
        players: [],
        scores: [],
        is_drawing: false,
        word_being_drawn: null,
        max_draw_time: 90,
        draw_time_remaining: null,
        max_rounds: null,
        current_round: 0,
        words_to_pick_from: 3
    };

    let canvas = {
        element: null,
        context: null,
        background_color: "#aaa",
        current_input: null,
        //@todo: Dynamically generate the height and width?
        //note: Or maybe keep this static? Too much time to handle dynamic sizing
        width: 800,
        height: 400,
        started_dragging: false,
        starting_mouse_position: {},
        current_color: "#FFF",
        current_line_width: 1,
        inputs: [],
        redo_queue: [],
        drawing_disabled: true,
        drawer_started_input: false,
        drawer_started_input_object: {}
    };

    function canvas_init() {
        let canvas_element = document.createElement("canvas");
        canvas_element.width = canvas.width;
        canvas_element.height = canvas.height;
        document.getElementById("canvas-wrapper").appendChild(canvas_element);
        canvas.element = canvas_element;
        canvas.context = canvas.element.getContext("2d");
        canvas.clear = function() {
            canvas.context.fillStyle = "#ccc";
            canvas.context.fillRect(0, 0, canvas.element.width, canvas.element.height);
            canvas.context.stroke();
        };

        canvas.clear();
        bind_canvas();
        bind_document();
    }

    function get_mouse_position(event) {
        return {
            x: event.clientX - canvas.element.offsetLeft,
            y: event.clientY - canvas.element.offsetTop
        };
    }

    function bind_canvas() {
        canvas.element.onmousedown = e => {
            if (canvas.drawing_disabled) {
                return;
            }

            canvas.started_dragging = true;
            let mouse_position = get_mouse_position(e);
            canvas.redo_queue = [];

            canvas.starting_mouse_position = mouse_position;

            canvas.current_input = {};
            canvas.current_input.start_x = mouse_position.x;
            canvas.current_input.start_y = mouse_position.y;
            canvas.current_input.color = canvas.current_color;
            canvas.current_input.line_width = canvas.current_line_width;
            canvas.current_input.path = [];

            socket.emit(
                "start_input", 
                {
                    start_x: mouse_position.x,
                    start_y: mouse_position.y,
                    color: canvas.current_color,
                    line_width: canvas.current_line_width,
                    path: []
                }
            );
        };

        canvas.element.onmousemove = e => {
            let mouse_position = get_mouse_position(e);

            if (canvas.current_input) {
                socket.emit(
                    "update_input_path",
                    {
                        x: mouse_position.x,
                        y: mouse_position.y
                    }
                );

                canvas.current_input.path.push({
                    x: mouse_position.x,
                    y: mouse_position.y
                });
            }
        };

        canvas.element.onmouseup = e => {
            canvas.started_dragging = false;
            canvas.starting_mouse_position = null;
            let final_mouse_position = get_mouse_position(e);

            if (canvas.current_input) {
                socket.emit(
                    "end_input",
                    {
                        final_x: final_mouse_position.x,
                        final_y: final_mouse_position.y
                    }
                );

                canvas.current_input.final_x = final_mouse_position.x;
                canvas.current_input.final_y = final_mouse_position.y;
    
                canvas.inputs.push(canvas.current_input);
                canvas.current_input = null;
            }
        };

        canvas.element.onmouseleave = e => {
            canvas.started_dragging = false;
            // Trigger click here? idk
        };
    }

    function bind_document() {
        document.onkeydown = e => {
            if (e.ctrlKey) {
                if (e.key === "z") {
                    if (canvas.inputs.length) {
                        socket.emit("undo", {});
                        let undone_input = canvas.inputs.splice(canvas.inputs.length - 1, 1);
                        canvas.redo_queue.push(undone_input[0]);
                    }
                }
                else if (e.key === "y") {
                    if (canvas.redo_queue.length) {
                        socket.emit("redo", {});
                        let redone_input = canvas.redo_queue.splice(canvas.redo_queue.length - 1, 1);
                        canvas.inputs.push(redone_input[0]);
                    }
                }
            }
        };

        let wrapper_chat = document.getElementById("wrapper-chat");
        let chat_input = document.getElementById("chat-input");

        chat_input.style.top = (wrapper_chat.offsetHeight - chat_input.offsetHeight) + "px";
        chat_input.style.marginBottom = `2px`;

        document.onwheel = e => {
            let scrolled_down = Math.sign(e.deltaY) == 1;

            // Scroll down is 1, scroll up is -1
            if (scrolled_down && canvas.current_line_width > 1) {
                canvas.current_line_width -= 2;
            }
            else if (!scrolled_down && canvas.current_line_width < 10) {
                canvas.current_line_width += 2;
            }
        };
    }

    function render_frame() {
        let current_frame = requestAnimationFrame(render_frame);

        canvas.clear();

        if (canvas.current_input) {
            canvas.context.beginPath();
            canvas.context.moveTo(canvas.current_input.start_x, canvas.current_input.start_y);
            canvas.context.fillStyle = canvas.current_input.color;
            canvas.context.lineWidth = canvas.current_input.line_width;
            
            for (let path_index = 0; path_index < canvas.current_input.path.length; path_index++) {
                canvas.context.lineTo(canvas.current_input.path[path_index].x, canvas.current_input.path[path_index].y);
                canvas.context.stroke();
            }
            
            canvas.context.lineTo(canvas.current_input.final_x, canvas.current_input.final_y);
            canvas.context.stroke();
        }
    
        if (canvas.drawer_started_input) {
            canvas.context.beginPath();
            canvas.context.moveTo(canvas.drawer_started_input_object.start_x, canvas.drawer_started_input_object.start_y);
            canvas.context.fillStyle = canvas.drawer_started_input_object.color;
            canvas.context.lineWidth = canvas.drawer_started_input_object.line_width;
            
            for (let path_index = 0; path_index < canvas.drawer_started_input_object.path.length; path_index++) {
                canvas.context.lineTo(canvas.drawer_started_input_object.path[path_index].x, canvas.drawer_started_input_object.path[path_index].y);
                canvas.context.stroke();
            }
            
            canvas.context.lineTo(canvas.drawer_started_input_object.final_x, canvas.drawer_started_input_object.final_y);
            canvas.context.stroke();
        }

        for (let input_index = 0; input_index < canvas.inputs.length; input_index++) {
            let input = canvas.inputs[input_index];

            canvas.context.beginPath();
            canvas.context.fillStyle = input.color;
            canvas.context.lineWidth = input.line_width;
            canvas.context.moveTo(input.start_x, input.start_y);
            
            for (let path_index = 0; path_index < input.path.length; path_index++) {
                canvas.context.lineTo(input.path[path_index].x, input.path[path_index].y);
            }
            
            canvas.context.lineTo(input.final_x, input.final_y);
            canvas.context.stroke();
        }
    }

    // -------- Start words ---------

    let word_list = [ "America", "Balloon", "Biscuit", "Blanket", "Chicken", "Chimney", "Country", "Cupcake", "Curtain", "Diamond", "Eyebrow", "Fireman", "Florida", "Germany", "Harpoon", "Husband", "Lobster", "Milkman", "Morning", "Octagon", "Octopus", "Popcorn", "Printer", "Sandbox", "Skyline", "Spinach", "Trailer", "Unibrow", "Wrinkle" ];

    function pick_words_from_list(number_of_words) {
        let resultant_words = [];

        for (let word_index = 0; word_index < number_of_words; word_index++) {
            let random_seed = Math.floor(Math.random() * word_list.length);
            resultant_words.push(word_list[random_seed]);
        }

        return resultant_words;
    }

    // Draw words if the current player is supposed to be the one drawing

    function draw_words_to_html(words) {
        for (let word_index = 0; word_index < words.length; word_index++) {
            let word_element = document.createElement("div");
            word_element.classList.add("word-choice");
            word_element.innerHTML = words[word_index];
            word_element.onclick = () => {
                game.word_being_drawn = word_element.innerHTML;

                // Remove the other words (empty the word list div)
                word_list_element.innerHTML = "";
                // Update the section for only the drawer, saying "You are drawing: {word}"

                // Now, we just start the draw time
                start_draw_session();
            };
            
            document.getElementById("word-list").append(word_element);
        }
    }

    function start_draw_session() {
        console.log("Starting draw session for current player...");
        console.log("Enabling the canvas for drawing");
        // Canvas should be disabled for everyone other than the current player
        canvas.drawing_disabled = false;
        console.log("Drawer is drawing the word " + game.word_being_drawn);
        if (game.current_round < game.players.length) {
            game.current_round++;
            console.log("Set current round to " + game.current_round);
        }
        else {
            // End the game? All players have drawn at this point
        }

        word_being_drawn_element.innerHTML = "You are drawing: " + game.word_being_drawn;

        // Start the round draw timer:

        game.draw_time_remaining = game.max_draw_time;
        round_timer.innerHTML = "Seconds remaining: " + game.draw_time_remaining;
        console.log(game.word_being_drawn.length);
        put_underscores_in_wrapper(game.word_being_drawn.length);

        let draw_time_interval = setInterval(() => {
            if (game.draw_time_remaining > 0) {
                game.draw_time_remaining--;
                round_timer.innerHTML = "Seconds remaining: " + game.draw_time_remaining;
            }
            else {
                clearInterval(draw_time_interval);
                // The draw round has ended!
            }
        }, 1000);
    }

    function put_underscores_in_wrapper(word_length) {
        //@todo(Matt): Calculate the width;
        word_being_guessed_element.innerHTML = "";

        for (let letter_index = 0; letter_index < word_length; letter_index++) {
            word_being_guessed_element.innerHTML += "_ ";
        }
    }

    //@todo(Matt): Have the server give us a single letter back which we can draw onto the HTML
    function replace_one_underscore_with_letter() {
        
    }

    socket.on("drawer_started_input", data => {
        console.log("Drawer started input");
        console.log(data);
        canvas.drawer_started_input = true;
        canvas.drawer_started_input_object = data;
    });

    socket.on("drawer_updated_path", data => {
        console.log("updated data:", data);
        canvas.drawer_started_input_object.path.push(data); 
    });

    socket.on("drawer_ended_input", data => {
        console.log("ended data:", data);
        //@todo: Extend two objects
        canvas.drawer_started_input_object.final_x = data.final_x; 
        canvas.drawer_started_input_object.final_y = data.final_y; 
        canvas.inputs.push(canvas.drawer_started_input_object);

        canvas.drawer_started_input_object = {};
        canvas.drawer_started_input = false;
    });

    

    // socket.on("drawer_updated_path", data => {
    //     console.log("Drawer updated path");
    //     canvas.drawer_started_input_object.path.push(data);
    // });

    // socket.on("drawer_ended_input", data => {
    //     console.log("Drawer ended input");
    //     canvas.drawer_started_input_object.final_x = data.final_x;
    //     canvas.drawer_started_input_object.final_y = data.final_y;
    //     canvas.inputs.push(canvas.drawer_started_input_object);
    //     canvas.drawer_started_input_object = {};
    //     canvas.drawer_started_input = false;
    // });

    //@todo(Matt): Player names
    socket.on("disconnect", data => {

    });
  
    socket.on("connected", data => {
        console.log("Connected!");
        console.log(data);
        console.log("Number of connections: " + data.connections);

        if (data.connections == 1) {
            let play_button_element = document.createElement("button");
            play_button_element.innerHTML = "Play";

            play_button_element.onclick = e => {
                game.started = true;
        
                socket.emit(
                    "start-game", 
                    { 
                        current_player: "Hey, let's play the fucking game!",
                        something_else_to_send: "Yo, game is being played..."
                    }
                );
        
                // Send event to the server, then server picks somebody to draw (the first connected player)
                // Server sets the draw order (order of players) and gives us back an event
        
                //@todo(Matt): If the current player is the drawer, then show the words
                if (true) {
                    draw_words_to_html(pick_words_from_list(game.words_to_pick_from));
                }
        
                // Set a timer? Maybe
                // This timer would make sure that the soon-to-be drawer couldn't infinitely stall the game
            };

            document.getElementById("canvas-wrapper").appendChild(play_button_element);
        }
    });

    socket.on("initialize", function(data) {
        console.log("on initialize....");
        console.log("Server has a greeting for you: " + data.hey);
        console.log(data);
    });
    
    function on_start() {
        canvas_init();
        render_frame();
    }

    on_start();
}

drawing_init();