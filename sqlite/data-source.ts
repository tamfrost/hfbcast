import "reflect-metadata"
import { DataSource } from "typeorm"
import { Site } from "./entity/Site"
import { Broadcast } from "./entity/Broadcast"

const currentTime = new Date();

export const AppDataSource = new DataSource({
    type: "sqlite",
    // database: `database_${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()}_${currentTime.getHours()}${currentTime.getMinutes()}${currentTime.getSeconds()}.sqlite`,
    database: `database.sqlite`,
    synchronize: true,
    logging: false,
    entities: [Site, Broadcast],
    migrations: [],
    subscribers: [],
})
