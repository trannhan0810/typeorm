import { Column, Entity, PrimaryGeneratedColumn } from "../../../../src"

@Entity()
export class Child {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    parentId: number

    @Column()
    initials: string
}
