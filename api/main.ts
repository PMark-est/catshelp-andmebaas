import express from "express";
import cors from "cors";
import * as jwt from "jsonwebtoken";
import * as utils from "./utils.ts";
import * as dotenv from "dotenv";
import { CatFormData } from "../src/types.ts";
import { google } from "googleapis";
import { join } from "https://deno.land/std/path/mod.ts";
import fs from "node:fs";
import db from "../models/index.cjs";

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

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: "https://www.googleapis.com/auth/drive",
  clientOptions: {
    subject: "markopeedosk@catshelp.ee",
  },
});

const client = await auth.getClient();

const drive = google.drive({
  version: "v3",
  auth: client,
});

app.use("/public", express.static(join(__dirname, "public")));

const createDriveFolder = (catName: string) => {
  var fileMetadata = {
    name: catName,
    mimeType: "application/vnd.google-apps.folder",
    parents: ["1_WfzFwV0623sWtsYwkp8RiYnCb2_igFd"],
    driveId: "0AAcl4FOHQ4b9Uk9PVA",
  };
  return drive.files.create({
    supportsAllDrives: true,
    requestBody: fileMetadata,
    fields: "id",
  });
};

const uploadToDrive = async (
  filename: string,
  filestream: fs.ReadStream,
  driveId: string
) => {
  const mimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
    svg: "image/svg+xml",
  };
  const lastDotIndex = filename.lastIndexOf(".");
  const ext = filename.slice(lastDotIndex + 1).toLowerCase();

  const requestBody = {
    name: filename,
    fields: "id",
    parents: [driveId],
  };

  const media = {
    mimetype: mimeTypes[ext],
    body: filestream,
  };

  try {
    const file = await drive.files.create({
      supportsAllDrives: true,
      requestBody,
      media: media,
      uploadType: "resumable",
      fields: "id",
    });
    return file.data.id;
  } catch (err) {
    // TODO(developer) - Handle error
    throw err;
  }
};

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
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const SHEETS_ID = process.env.CATS_SHEETS_ID;

  const rows = await sheets.spreadsheets.get({
    auth: auth,
    spreadsheetId: SHEETS_ID,
    ranges: ["HOIUKODUDES"],
    includeGridData: true,
  });

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
      if (fosterhome.formattedValue! !== "Tatjana Gerassimova") return;

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
            `./public/Cats/${catName}.png`
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

// app.get("/api/cat-profile/:ownerName", async (req, res) => {
//   const ownerName = req.params.ownerName;
app.get("/api/cat-profile", async (req, res) => {
  const ownerName = "Mari Oks";

  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const SHEETS_ID = process.env.CATS_SHEETS_ID!;

  const sheetData = await fetchGoogleSheetData(
    client,
    SHEETS_ID,
    "HOIUKODUDES"
  );
  const columnNamesWithIndexes: { [key: string]: number } = {};

  sheetData![0].rowData![0].values!.forEach((col, idx) => {
    if (col.formattedValue) {
      columnNamesWithIndexes[col.formattedValue] = idx;
    }
  });

  const catProfiles: any[] = [];

  for (const grid of sheetData) {
    for (const row of grid.rowData || []) {
      const values = row.values;

      const fosterhome =
        row.values![columnNamesWithIndexes["_HOIUKODU/ KLIINIKU NIMI"]];
      if (fosterhome.formattedValue! !== ownerName) continue;

      if (!values) continue;

      const catName =
        values[columnNamesWithIndexes["KASSI NIMI"]]?.formattedValue || "";
      const imageLink = values[columnNamesWithIndexes["PILT"]]?.hyperlink || "";

      const catProfile = {
        primaryInfo: {
          name: catName,
          image: "",
          rescueId:
            values[
              columnNamesWithIndexes["PÄÄSTETUD JÄRJEKORRA NR (AA'KK nr ..)"]
            ]?.formattedValue || "",
          location:
            values[columnNamesWithIndexes["ASUKOHT"]]?.formattedValue || "",
          dateOfBirth:
            values[columnNamesWithIndexes["SÜNNIAEG"]]?.formattedValue || "",
          gender: values[columnNamesWithIndexes["SUGU"]]?.formattedValue || "",
          color:
            values[columnNamesWithIndexes["KASSI VÄRV"]]?.formattedValue || "",
          furLength:
            values[columnNamesWithIndexes["KASSI KARVA PIKKUS"]]
              ?.formattedValue || "",
          additionalNotes:
            values[columnNamesWithIndexes["TÄIENDAVAD MÄRKMED"]]
              ?.formattedValue || "",
          chipId: values[columnNamesWithIndexes["KIIP"]]?.formattedValue || "",
          rescueDate:
            values[columnNamesWithIndexes["PÄÄSTMISKP/ SÜNNIKP"]]
              ?.formattedValue || "",
        },
        moreInfo: {
          otherInfo:
            values[columnNamesWithIndexes["MUU"]]?.formattedValue || "",
        },
      };

      if (imageLink && isHyperlink(imageLink)) {
        const fileId = extractFileId(imageLink);

        if (fileId) {
          const destinationPath = `./public/Cats/${catName}.png`;

          const downloadSuccess = await downloadImage(
            drive,
            fileId,
            destinationPath
          );
          if (downloadSuccess) {
            catProfile.primaryInfo.image = `Cats/${catName}.png`;
          }
        } else {
          console.warn(`Unable to extract fileId from imageLink: ${imageLink}`);
        }
      }

      catProfiles.push(catProfile);
    }
  }

  return res.json({ catProfiles });
});

async function downloadImage(
  drive: any,
  fileId: string,
  destinationPath: string
) {
  try {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    const writeStream = fs.createWriteStream(destinationPath);
    await new Promise((resolve, reject) => {
      response.data
        .pipe(writeStream)
        .on("finish", () => resolve(true))
        .on("error", reject);
    });

    console.log(`Image downloaded and saved to: ${destinationPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to download image with ID ${fileId}:`, error);
    return false;
  }
}

function isHyperlink(link: string): boolean {
  try {
    new URL(link);
    return true;
  } catch {
    return false;
  }
}

function extractFileId(link: string): string | null {
  const match = link.match(/\/file\/d\/(.+?)\//);
  return match ? match[1] : null;
}

async function fetchGoogleSheetData(auth: any, sheetId: string, range: string) {
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    ranges: [range],
    includeGridData: true,
  });
  if (!response.data.sheets || !response.data.sheets[0].data) {
    throw new Error("No data available in the provided range or sheet.");
  }

  return response.data.sheets[0].data;
}

app.post("/api/animals", async (req: any, res: any) => {
  const formData: CatFormData = req.body;
  const rescueDate = formData.leidmis_kp;

  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const client = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: client,
  });

  const SHEETS_ID = process.env.CATS_SHEETS_ID;

  const animal = await db.Animal.create();

  delete formData.pildid;
  const a = { id: animal.id, ...formData };

  await sheets.spreadsheets.values.append({
    auth: auth,
    spreadsheetId: SHEETS_ID,
    range: "HOIUKODUDES",
    valueInputOption: "RAW",
    resource: {
      values: [Object.values(a)],
    },
  });

  const animalRescue = await db.AnimalRescue.create({
    rescue_date: rescueDate,
  });

  const animalToAnimalRescue = await db.AnimalToAnimalRescue.create({
    animal_id: animal.id,
    animal_rescue_id: animalRescue.id,
  });
});

app.post("/api/pilt/lisa", async (req, res) => {
  try {
    const catName = req.get("Cat-Name");
    const driveFolder = await createDriveFolder(catName);
    const folderID = driveFolder.data.id;
    let uploadedFiles = req.files.images;

    uploadedFiles = Array.isArray(uploadedFiles)
      ? uploadedFiles
      : [uploadedFiles];

    uploadedFiles.forEach((file, idx) => {
      const tempPath = file.tempFilePath;
      uploadToDrive(catName, fs.createReadStream(tempPath), folderID!);
    });

    return res.json("Pildid laeti üles edukalt");
  } catch (error) {
    return res.error("Tekkis tõrge piltide üles laadimisega:", error);
  }
});

app.listen(process.env.BACKEND_PORT, () => {
  console.log("connected to backend!");
});
