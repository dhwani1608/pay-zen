import { prisma } from "./lib/prisma";

async function main() {
  try {
    const user = await prisma.user.findFirst();
    const group = await prisma.group.findFirst();
    if (!user || !group) return console.log("No data");

    const mem = await prisma.groupMember.findFirst();
    console.log("Found member", mem);
    
    // Testing which key allows delete
    console.log(prisma.groupMember.delete.toString());
  } catch (error) {
    console.error(error);
  }
}
main();
