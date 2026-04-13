import { prisma } from "@/lib/db/prisma";

export async function listAppUsersForAgent(): Promise<
  { id: number; username: string; email: string; isAdmin: boolean }[]
> {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      isAdmin: true,
    },
    orderBy: { id: "asc" },
    take: 50,
  });
}
