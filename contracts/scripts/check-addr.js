import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const code = await ethers.provider.getCode("0x15C7881801F78ECFad935c137eD38B7F8316B5e8");
  console.log("CODE_LENGTH:", code.length);
  if (code === "0x") {
    console.log("STATUS: EMPTY");
  } else {
    console.log("STATUS: VALID_CONTRACT");
  }
}

main().catch(console.error);
