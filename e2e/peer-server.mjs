import { PeerServer } from "peer";
PeerServer({ port: 9100, host: "127.0.0.1", path: "/", allow_discovery: true });
console.log("PEER_READY");
