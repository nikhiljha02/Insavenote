import bcrypt from "bcrypt";

let pass = "123546";

// let hash = await bcrypt.hash(pass, 10);
// console.log(hash);

let com = "$2b$10$uSZ3vz3iCGUVg3owwyqCzO/wAqHyJaJlKPrEeKV3.Ai9FVTRoPhvq";
console.log(await bcrypt.compare(pass, com));
