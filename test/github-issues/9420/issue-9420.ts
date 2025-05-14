import { expect } from "chai"
import { DataSource } from "../../../src"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../utils/test-utils"
import { User } from "./entity/User"
import { Child } from "./entity/Child"
import { Parent } from "./entity/Parent"

describe("github issues > #9420 Get error 'Cannot get metadata of given alias' when order column from subquery.", () => {
    let connections: DataSource[]
    before(async () => {
        connections = await createTestingConnections({
            enabledDrivers: ["postgres"],
            entities: [User, Parent, Child], // Include the entities needed for the original issue
            schemaCreate: true,
            dropSchema: true,
            logging: true,
        })
    })
    beforeEach(() => reloadTestingDatabases(connections))
    after(() => closeTestingConnections(connections))

    it("should throw TypeORMError when trying to orderBy on a subquery alias directly", async () => {
        await Promise.all(
            connections.map(async (connection) => {
                // Seed data (optional but helpful for context)
                const parent1 = new Parent()
                await connection.getRepository(Parent).save(parent1)

                const parent2 = new Parent()
                await connection.getRepository(Parent).save(parent2)

                await connection.getRepository(Child).save([
                    { parentId: parent1.id, initials: "AB" },
                    { parentId: parent1.id, initials: "CD" },
                    { parentId: parent1.id, initials: "AA" },
                    { parentId: parent2.id, initials: "XY" },
                    { parentId: parent2.id, initials: "YZ" },
                ])

                const query = connection
                    .createQueryBuilder(Parent, "parent")
                    .innerJoinAndSelect(
                        (subQuery) => {
                            return subQuery
                                .from(Child, "child")
                                .select("child.parentId", "parentId")
                                .addSelect("MAX(initials)", "maxInitials")
                                .groupBy('"parentId"')
                        },
                        "child",
                        'parent.id = child."parentId"',
                    )
                    .orderBy('child."maxInitials"', "ASC")

                console.log(query.getQuery())

                const parents = await query.skip(0).take(2).getMany()

                console.log(parents)
                expect(parents.length).to.equal(2)

                expect(parents[0].id).to.equal(1) // Expected: Parent 1 (max initials 'CD')
                expect(parents[1].id).to.equal(2) // Expected: Parent 2 (max initials 'YZ')
            }),
        )
    })

    it("should allow ordering by a column from a subquery used in a 'from' clause", async () => {
        await Promise.all(
            connections.map(async (connection) => {
                const userRepository = connection.getRepository(User)

                await userRepository.save([
                    { name: "DEFxyz", email: "DEFxyz@mail.com" },
                    { name: "ABCxyz", email: "ABCxyz@mail.com" },
                    { name: "GHIxyz", email: "GHIxyz@mail.com" },
                ])

                const userSubQb = userRepository
                    .createQueryBuilder("user")
                    .select("user.id", "id")
                    .addSelect("user.name", "name")
                    .where("user.name = :name", { name: "ABCxyz" })

                const userQuery = connection
                    .createQueryBuilder()
                    .select(["sub.id", "sub.name"])
                    .from("(" + userSubQb.getQuery() + ")", "sub")
                    .setParameters(userSubQb.getParameters())
                    .orderBy("sub.name", "ASC")

                const results = await userQuery.getRawMany()
                expect(results).to.deep.eq([{ id: 2, name: "ABCxyz" }])
            }),
        )
    })
})
