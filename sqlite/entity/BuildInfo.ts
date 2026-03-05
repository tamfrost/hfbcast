import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class BuildInfo {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    buildDate: string

    @Column()
    commitHash: string

}
