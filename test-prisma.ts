import { prisma } from "./lib/prisma"

async function main() {
    try {
        console.log(Object.keys(prisma.groupMember.fields))
    } catch {
        console.log("No fields info")
    }
}
main()
