#!/usr/bin/env node
import { serveStdio, StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

// stdout belongs exclusively to the MCP protocol.
serveStdio(() => createServer(), {
  transport: new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 262_144 }),
  onerror: () => { console.error("Hypothra MCP transport error."); },
});
