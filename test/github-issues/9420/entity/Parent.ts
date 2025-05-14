import { Entity, PrimaryGeneratedColumn } from "../../../../src"

@Entity()
export class Parent {
    @PrimaryGeneratedColumn()
    id: number
}
