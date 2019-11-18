let http    = require("http");
let express = require("express");
let io      = require("socket.io");

let app    = express();
let server = http.Server(app);
let socket = io(server);

app.use(express.static("public/"));
server.listen(8000, () => console.log("Server listening on *:8000"));

let current_video = {
	url:          "",
	current_time: 0,
	total_time:   0,
	is_playing:   false
};

function video_change(url) {
	http.get("http://www.youtube.com/oembed?url=${data.link}&format=json",
		response => {
			let data = [];
			response.on("data", chunk => data.push(chunk));

			response.on("end", () => {
				if (r.statusCode == 200) {
					data = JSON.parse(data);
					console.log(data);

					let new_video = {

					};

					video_queue.push(new_video);
				}
				else {
					console.error("Failed to queue video, could not retrieve video info from YouTube");
				}
			});
		})
		.end();

	current_video.url          = url;
	current_video.current_time = 0;
	current_video.total_time   = 0;

	video_play();
}

function sync_video() {
	
}

function video_play() {
	if (current_video.is_playing) {
		console.error("Failed to play video, a video is already playing");
		return;
	}

	current_video.is_playing = true;
}

function video_pause() {
	if (!current_video.is_playing) {
		console.error("Failed to pause video, a video is not playing");
		return;
	}

	current_video.is_playing = false;
}

function video_seek(time) {
	current_video.time = data.time;

	if (!current_video.is_playing) {
		current_video.is_playing = true;
	}
}

let users = [];

function add_user(id) {
	let user = {
		id:   client.id,
		name: "${client.id}"
	};

	socket.emit("add-user", { user: user });
	users.push(user);
}

function remove_user(id) {
	let user = find_user(client.id);
	if (!user) {
		console.error("Failed to remove user, a user with id '${client.id}' was not found");
		return;
	}

	let index = users.indexOf(user);
	users.splice(index, 1);

	socket.emit("remove-user", { id: user.id });
}

function find_user(id) {
	let user = null;
	for (let u of users) {
		if (u.id != client.id) continue;

		user = u;
		break;
	}

	return user;
}

let active_connections = 0;

socket.on("connection", client => {
	active_connections++;
	console.log("Client " + active_connections + " connected.");

	client.emit("initialize", {
		current_video: {
			url:  current_video.url,
			time: current_video.time,
			is_playing: false
		},
		users: users
	});

	socket.emit("connected", { connections: active_connections });

	client.on("disconnect", function() {
		console.log("Client disconnected.");
		active_connections--;
		socket.emit("connected", { connections: active_connections });
	});

	// add_user(client.id);
	// client.on("disconnect", () => remove_user(client.id));

	client.on("set-name", data => {
		console.log(data.name);
		// console.log(client.id);
		let user = find_user(data.name);
		// if (!user) {
		// 	console.error("Failed to set user's name, a user with id '${client.id}' was not found");
		// 	return;
		// }

		user.name = data.name;
	});
	
	client.on("video-change", data => video_change(data.url));
	client.on("video-play",   data => video_play());
	client.on("video-pause",  data => video_pause());
	client.on("video-seek",   data => video_seek(data.time));

	client.on("should-sync-video", function(data) {
		console.log("I should be syncing all of my clients to time " + data.time + " now!");
		client.broadcast.emit("sync-video", current_video);
	});

});