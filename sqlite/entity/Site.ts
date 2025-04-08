import {Entity, PrimaryGeneratedColumn, Column, Unique, OneToMany} from "typeorm";
import {Broadcast} from "./Broadcast";

@Entity()
@Unique(['name'])
export class Site {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    power: number;

    @Column()
    lon: number;

    @Column()
    lat: number;

    @OneToMany(type => Broadcast, broadcasts => broadcasts.site)
    broadcasts: Broadcast[];

}
