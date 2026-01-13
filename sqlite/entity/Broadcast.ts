import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique} from "typeorm";
import {Site} from "./Site";

@Entity()
@Unique(['frequency', 'days', 'startTime', 'endTime', 'station', 'country', 'language', 'site'])
export class Broadcast {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: "real", nullable: true})
    frequency: number;

    @Column({type: "integer", nullable: true})
    days: number;

    @Column({type: "integer", nullable: true})
    startTime: number;

    @Column({type: "integer", nullable: true})
    endTime: number;

    @Column({type: "text", nullable: true})
    station: string;

    @Column({type: "text", nullable: true})
    country: string;

    @Column({type: "text", nullable: true})
    language: string;

    @Column({type: "text", nullable: true})
    source: string;

    @ManyToOne(type => Site)
    @JoinColumn()
    site: Site;
}
