require('dotenv').config();

const express = require('express');
const cors = require('cors');

const playlistRoutes = require('./routes/playlist');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', playlistRoutes);

app.get('/', (req, res) => {
  res.send('서버 실행 성공!');
});

app.listen(3000, () => {
  console.log('서버 실행중');
});