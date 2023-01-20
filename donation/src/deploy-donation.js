import * as helios from "../helios.js"

const donationSrc = await Deno.readTextFile("./src/donation.hl");
const program = helios.Program.new(donationSrc);
const simplify = false;
const uplcProgram = program.compile(simplify);

const vHash = uplcProgram.validatorHash;
console.log("donation hash: ", vHash.hex);
console.log("donation address: ", helios.Address.fromValidatorHash(vHash).toBech32());

await Deno.writeTextFile("./deploy/donation.plutus", uplcProgram.serialize());
await Deno.writeTextFile("./deploy/donation.hash", vHash.hex);
await Deno.writeTextFile("./deploy/donation.addr", helios.Address.fromValidatorHash(vHash).toBech32());
