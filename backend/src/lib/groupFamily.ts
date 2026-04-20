import prisma from './prisma'

export async function getGroupFamilyIds(groupId: string): Promise<string[]> {
  const result: string[] = [groupId]
  let curr = groupId
  while (true) {
    const g = await prisma.studentGroup.findUnique({ where: { id: curr }, select: { parentGroupId: true } })
    if (!g?.parentGroupId) break
    result.push(g.parentGroupId)
    curr = g.parentGroupId
  }
  const queue = [groupId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const children = await prisma.studentGroup.findMany({ where: { parentGroupId: id }, select: { id: true } })
    for (const c of children) { result.push(c.id); queue.push(c.id) }
  }
  return result
}
