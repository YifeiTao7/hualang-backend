const cron = require('node-cron');
const { Storage } = require('@google-cloud/storage');
const Artwork = require('../models/Artwork');
const Artist = require('../models/Artist');

const credentials = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

const storage = new Storage({ credentials });
const bucket = storage.bucket('yifeitaoblogs');

cron.schedule('0 0 * * *', async () => { // 每天凌晨执行一次
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 1));

    const artworksToDelete = await Artwork.find({
      saleDate: { $lte: sevenDaysAgo },
      isSold: true,
    });

    for (const artwork of artworksToDelete) {
      await Artwork.findByIdAndDelete(artwork._id);

      const artist = await Artist.findById(artwork.artist);
      if (artist) {
        artist.artworks = artist.artworks.filter(artworkId => !artworkId.equals(artwork._id));
        await artist.save();
      }

      // 删除 Google Cloud Storage 上的图片
      const fileName = artwork.imageUrl.split('/').pop();
      const filePath = `artworks/${fileName}`;
      try {
        await storage.bucket(bucket.name).file(filePath).delete();
        console.log(`Deleted file from Google Cloud Storage: ${filePath}`);
      } catch (err) {
        console.error(`Failed to delete file from Google Cloud Storage: ${filePath}`, err);
        if (err.code !== 404) {
          throw err; // 处理其他类型的错误
        }
      }
    }

    console.log('Artworks and associated images deleted successfully');
  } catch (error) {
    console.error('Failed to delete artworks', error);
  }
});
