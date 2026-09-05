"use client";

import { io } from "socket.io-client";

let socket;

export function get_socket() {
  if (!socket) {
    socket = io();
  }

  return socket;
}