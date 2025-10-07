require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const STORAGE_PATH =
  process.env.STORAGE_PATH || path.join(__dirname, "storage");

if (!fs.existsSync(STORAGE_PATH))
  fs.mkdirSync(STORAGE_PATH, { recursive: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, STORAGE_PATH),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use("/uploads", express.static(STORAGE_PATH));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.post("/users", upload.single("photo"), async (req, res) => {
  const { name, email } = req.body;
  const photo = req.file ? req.file.filename : null;
  try {
    await pool.query("INSERT INTO users(name,email,photo) VALUES($1,$2,$3)", [
      name,
      email,
      photo,
    ]);
    res.redirect("/users");
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

app.get("/users", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id,name,email,photo FROM users ORDER BY id DESC"
    );
    res.send(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Users List - Project-PaaS</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              primary: '#4f46e5',
            },
            animation: {
              'gradient': 'gradient 8s linear infinite',
            },
            keyframes: {
              gradient: {
                '0%, 100%': {
                  'background-size': '200% 200%',
                  'background-position': 'left center'
                },
                '50%': {
                  'background-size': '200% 200%',
                  'background-position': 'right center'
                }
              },
            },
          }
        }
      }
    </script>
  </head>
  <body class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 py-8 px-4 animate-gradient">
    <div class="max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
          Daftar Users
        </h1>
        <a 
          href="/" 
          class="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gray-800/50 backdrop-blur-sm hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:-translate-y-0.5 border-gray-700/50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Tambah User
        </a>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${rows.map(user => `
          <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1 border border-gray-700/50">
            <div class="p-6 space-y-4">
              <div class="flex justify-center">
                <div class="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-500/50 shadow-lg">
                  <img 
                    class="w-full h-full object-cover" 
                    src="${user.photo ? `/uploads/${user.photo}` : 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}" 
                    alt="${user.name}'s photo"
                  >
                </div>
              </div>
              <div class="text-center">
                <h3 class="text-xl font-semibold text-white mb-2">${user.name}</h3>
                <p class="text-indigo-400">${user.email}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </body>
</html>
`);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

const init = async () => {
  await pool.query(`
CREATE TABLE IF NOT EXISTS users (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
email TEXT NOT NULL UNIQUE,
photo TEXT
)
`);
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

init();
