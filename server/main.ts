import express from "express";
import cors from "cors";
import * as jwt from "jsonwebtoken";
import * as utils from "./utils/utils.ts";
import * as dotenv from "dotenv";
import { CatFormData } from "../src/types.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import fs from "node:fs";
import db from "../models/index.cjs";
import GoogleService from "./services/google-service.ts";

// Seda ei tohi eemaldada
// Mingi fucked magic toimub siin, et peab vähemalt
// üks kord kutsuma teda, muidu ei toimi
db;
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Get the equivalent of __dirname
const __filename = new URL(import.meta.url).pathname;
const __dirname = __filename.substring(0, __filename.lastIndexOf("/")); // Get the directory path

app.use("/public", express.static(join(__dirname, "public")));

app.post("/api/login", (req: any, res: any) => {
    const body = req.body;
    const id = body.id;
    const email = body.email;
    console.log(email);
    utils.sendRequest(id, email);
    res.json("Success");
});

app.get("/api/verify", (req: any, res: any) => {
    const token = req.query.token;
    if (token == null) return res.sendStatus(401);
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        return res.redirect("/dashboard");
    } catch (e) {
        res.sendStatus(401);
    }
});

// TODO:
// 1. query paramina hooldekodu nime kaudu otsimine
// 2. meelespea tabel
app.get("/api/animals/dashboard", async (req, res) => {
    const googleService = await GoogleService.create();
    const rows = googleService.getSheetData(process.env.CATS_SHEETS_ID, "HOIUKODUDES")

    const random = rows.data.sheets![0].data;
    const columnNamesWithIndexes: { [key: string]: number } = {};

    random![0].rowData![0].values!.forEach((col, idx) => {
        if (!col.formattedValue) return;
        columnNamesWithIndexes[col.formattedValue!] = idx;
    });

    const fosterhomeCats: { [key: string]: any } = {
        pets: [],
        todos: [],
    };

    const pattern = new RegExp("(?<=/d/).+(?=/)");

    random?.forEach((grid) => {
        grid.rowData!.forEach(async (row) => {
            const fosterhome =
                row.values![columnNamesWithIndexes["_HOIUKODU/ KLIINIKU NIMI"]];
            if (fosterhome.formattedValue! !== "Mari Oks") return;

            const values = row.values!;
            const catName =
                values[columnNamesWithIndexes["KASSI NIMI"]].formattedValue;
            fosterhomeCats.pets.push({
                name: catName,
                image: `Cats/${catName}.png`,
            });
            if (
                new Date(
                    values[
                        columnNamesWithIndexes["JÄRGMISE VAKTSIINI AEG"]
                    ].formattedValue!
                ) < new Date()
            ) {
                console.log("overdue!");
                fosterhomeCats["todos"].push({
                    label: "Broneeri veterinaari juures vaktsineerimise aeg",
                    date: values[columnNamesWithIndexes["JÄRGMISE VAKTSIINI AEG"]]
                        .formattedValue,
                    assignee: catName,
                    action: "Broneeri aeg",
                    pet: catName,
                    urgent: true,
                    isCompleted: false,
                });
            }
            try {
                const stat = await Deno.stat(`./public/Cats/${catName}.png`);
                if (stat.isFile) {
                    console.log("The file exists.");
                } else {
                    console.log("The path exists but is not a file.");
                }
            } catch (error) {
                if (error instanceof Deno.errors.NotFound) {
                    // TODO: hyperlink voib olla undefined
                    const imageID =
                        values[columnNamesWithIndexes["PILT"]].hyperlink!.match(
                            pattern
                        )![0];

                    //TODO: kontrolli kas fail on juba kaustas olemas
                    const file = await drive.files.get(
                        {
                            supportsAllDrives: true,
                            fileId: imageID,
                            alt: "media",
                        },
                        { responseType: "stream" }
                    );

                    const destination = fs.createWriteStream(
                        `./public/Cats/${fosterhomeCats["pets"]["name"]}.png`
                    );

                    await new Promise((resolve) => {
                        file.data.pipe(destination);

                        destination.on("finish", () => {
                            resolve(true);
                        });
                    });
                    console.log("The file does not exist.");
                } else {
                    console.error("An unexpected error occurred:", error);
                }
            }
        });
    });

    return res.json(fosterhomeCats);
});

app.post("/api/animals", async (req: any, res: any) => {
    const googleService = await GoogleService.create();
    const formData: CatFormData = req.body;
    const rescueDate = formData.leidmis_kp;

    const animal = await db.Animal.create(process.env.CATS_SHEETS_ID);

    delete formData.pildid;
    const a = { id: animal.id, ...formData };

    await googleService.addDataToSheet(process.env.CATS_SHEETS_ID, "HOIUKODUDES", a);

    const animalRescue = await db.AnimalRescue.create({
        rescue_date: rescueDate,
    });

    const animalToAnimalRescue = await db.AnimalToAnimalRescue.create({
        animal_id: animal.id,
        animal_rescue_id: animalRescue.id,
    });
    res.json("Success");
});

app.post("/api/pilt/lisa", async (req, res) => {
    const googleService = await GoogleService.create();

    try {
        const catName = req.get("Cat-Name");
        const driveFolder = await googleService.createDriveFolder(catName);
        const folderID = driveFolder.data.id;
        let uploadedFiles = req.files.images;

        uploadedFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

        uploadedFiles.forEach((file, idx) => {
            const tempPath = file.tempFilePath;
            googleService.uploadToDrive(catName, fs.createReadStream(tempPath), folderID!);
        });

        return res.json("Pildid laeti üles edukalt");
    } catch (error) {
        return res.error("Tekkis tõrge piltide üles laadimisega:", error);
    }
});

app.listen(process.env.BACKEND_PORT, () => {
    console.log("connected to backend!");
});