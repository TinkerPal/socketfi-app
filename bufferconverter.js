const wasmHash =
  "f8428041bcbb6814cada8e70a3940a50b5b39dfeba68dcf84be1ee51b0ccf375";

// Convert the hexadecimal string to a Uint8Array

const hashtobuffer = Buffer.from(wasmHash);

const hashtobuffer2 = new Uint8Array(
  wasmHash.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
);

const bytes = [];
for (let i = 0; i < wasmHash.length; i += 2) {
  bytes.push(parseInt(wasmHash.substr(i, 2), 16));
}

// Create a Uint8Array from the bytes
const hashtobuffer3 = new Uint8Array(bytes);
