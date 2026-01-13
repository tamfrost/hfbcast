import {Entity, PrimaryGeneratedColumn, Column, Unique, OneToMany} from "typeorm";
import {Broadcast} from "./Broadcast";

@Entity()
@Unique(['name'])
export class Site {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: "text"})
    name: string;

    @Column({type: "real"})
    power: number;

    @Column({type: "real"})
    lon: number;

    @Column({type: "real"})
    lat: number;

    @OneToMany(type => Broadcast, broadcasts => broadcasts.site)
    broadcasts: Broadcast[];

}
