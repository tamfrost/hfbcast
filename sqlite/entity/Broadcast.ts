import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique} from "typeorm";
import {Site} from "./Site";

@Entity()
@Unique(['frequency', 'days', 'startTime', 'endTime', 'station', 'country', 'language', 'site'])
export class Broadcast {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({nullable: true})
    frequency: number;

    @Column({nullable: true})
    days: number;

    @Column({nullable: true})
    startTime: number;

    @Column({nullable: true})
    endTime: number;

    @Column({nullable: true})
    station: string;

    @Column({nullable: true})
    country: string;

    @Column({nullable: true})
    language: string;

    @Column({nullable: true})
    source: string;

    @ManyToOne(type => Site)
    @JoinColumn()
    site: Site;
}
