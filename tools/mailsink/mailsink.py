"""Minimal SMTP sink for local testing: accepts every message and saves it as an .eml file.
Usage: python mailsink.py [port]   (default 2525). Nothing is delivered anywhere."""
import os
import socketserver
import sys
import time

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "messages")
os.makedirs(OUT, exist_ok=True)


class Handler(socketserver.StreamRequestHandler):
    def send(self, line):
        self.wfile.write((line + "\r\n").encode())

    def handle(self):
        self.send("220 mailsink ready")
        rcpt = []
        while True:
            line = self.rfile.readline()
            if not line:
                return
            cmd = line.decode(errors="replace").strip()
            upper = cmd.upper()
            if upper.startswith(("EHLO", "HELO")):
                self.send("250 mailsink")
            elif upper.startswith("MAIL FROM"):
                rcpt = []
                self.send("250 OK")
            elif upper.startswith("RCPT TO"):
                rcpt.append(cmd[8:].strip(" <>"))
                self.send("250 OK")
            elif upper == "DATA":
                self.send("354 End data with <CR><LF>.<CR><LF>")
                data = []
                while True:
                    chunk = self.rfile.readline()
                    if chunk in (b".\r\n", b".\n", b""):
                        break
                    data.append(chunk[1:] if chunk.startswith(b"..") else chunk)
                name = f"{time.strftime('%Y%m%d-%H%M%S')}-{int(time.time() * 1000) % 1000:03d}-{rcpt[0] if rcpt else 'unknown'}.eml"
                with open(os.path.join(OUT, name.replace("@", "_at_")), "wb") as f:
                    f.writelines(data)
                print("saved", name, flush=True)
                self.send("250 OK queued")
            elif upper == "QUIT":
                self.send("221 bye")
                return
            else:
                self.send("250 OK")


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


port = int(sys.argv[1]) if len(sys.argv) > 1 else 2525
print(f"mailsink listening on localhost:{port}, saving to {OUT}", flush=True)
Server(("127.0.0.1", port), Handler).serve_forever()
