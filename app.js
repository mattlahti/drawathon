// const request = require('request');

// const app = express();

// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '');
//   next();
// });

// app.get('/jokes/random', (req, res) => {
//   request(
//     { url: 'https://joke-api-strict-cors.appspot.com/jokes/random' },
//     (error, response, body) => {
//       if (error || response.statusCode !== 200) {
//         return res.status(500).json({ type: 'error', message: err.message });
//       }

//       res.json(JSON.parse(body));
//     }
//   )
// });

let port = process.env.PORT || 3000;
let http = require('http');
// let express = require("express");
let fs = require('fs');
let html = fs.readFileSync('index.html');
let html_two = fs.readFileSync('index_two.html');
let js = fs.readFileSync('drawing.js');
let io = require("socket.io");

let log = function(entry) {
    fs.appendFileSync('/tmp/sample-app.log', new Date().toISOString() + ' - ' + entry + '\n');
};

let server = http.createServer(function (req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'http://draw-env.yyweenj2er.us-east-2.elasticbeanstalk.com');

    if (req.method === 'POST') {
        let body = '';

        req.on('data', function(chunk) {
            body += chunk;
        });

        req.on('end', function() {
            if (req.url === '/') {
                log('Received message: ' + body);
            } else if (req.url = '/scheduled') {
                log('Received task ' + req.headers['x-aws-sqsd-taskname'] + ' scheduled at ' + req.headers['x-aws-sqsd-scheduled-at']);
            }

            res.writeHead(200, 'OK', {'Content-Type': 'text/plain'});
            res.end();
        });
    } else {
        if (req.url.includes("drawing.js")) {
            res.writeHead(200);
            res.write(js);
            res.end();
        }
        else if (req.url.includes("index_two.html")) {
            res.writeHead(200);
            res.write(html_two);
            res.end();
        }
        else {
            res.writeHead(200);
            res.write(html);
            res.end();
        }
    }
});

let socket = io(server);
socket.origins("*:*");

let active_connections = 0;
// Keep persistent server variables here
let word_list = [ "America", "Balloon", "Biscuit", "Blanket", "Chicken", "Chimney", "Country", "Cupcake", "Curtain", "Diamond", "Eyebrow", "Fireman", "Florida", "Germany", "Harpoon", "Husband", "Lobster", "Milkman", "Morning", "Octagon", "Octopus", "Popcorn", "Printer", "Sandbox", "Skyline", "Spinach", "Trailer", "Unibrow", "Wrinkle" ];


socket.on("connection", client => {
    // let inputs = [];
    let redo_queue = [];
    let current_input = {};

    active_connections++;
    console.log("Client connected");

    // Send message "initialize" to ONLY the connected client
    client.emit("initialize", {
		hey: "Hello!"
	});

    // Send message "connected" to ALL connected clients
	socket.emit(
        "connected", 
        { 
            connections: active_connections 
        }
    );

    client.on("disconnect", function() {
		console.log("Client disconnected.");
		active_connections--;
		socket.emit(
            "connected", 
            { 
                connections: active_connections 
            }
        );
    });

    client.on("play-button-clicked", data => {
        socket.emit("return-play", data);
    });

    client.on("random_words", data => {
        let seeds = [];
        for (let word_index = 0; word_index < data.number_of_words; word_index++) {
            let random_seed = Math.floor(Math.random() * word_list.length);

            if(!seeds.includes(random_seed)){
                resultant_words.push(word_list[random_seed]);
                seeds.push(random_seed);
            }
        }
    });
    

    // let inputs = [];
    client.on("start_input", data => {
        // console.log("Data:", data);
        // inputs.push(data.start_x);
        // inputs.push(data.start_y);
        // inputs.push(data.color);
        // inputs.push(data.line_width);
        // inputs.push(data.path);
        socket.emit("drawer_started_input", data);
    });

    client.on("update_input_path", data => {
        // inputs[4].push(data);
        socket.emit("drawer_updated_path", data);
    });

    client.on("end_input", data => {
        // inputs.push(data.final_x);
        // inputs.push(data.final_y);
        socket.emit("drawer_ended_input", data);
        // inputs = [];
    });
});

server.listen(port);

let date = new Date();
console.log(`[${date.getTime()}] Server running on ${port}`);