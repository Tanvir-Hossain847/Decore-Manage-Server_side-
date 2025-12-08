const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const port = process.env.PORT || 3000
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();
// middlewere
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.VITE_userName}:${process.env.VITE_password}@tanvir369.ymezqkm.mongodb.net/?appName=Tanvir369`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/' , (req, res) => {
    res.send("the server is running from port 3000")
})

async function run() {
    try {
        await client.connect()

        const decorDB = client.db("styleDecor")
        const collection = decorDB.collection("services")
        const bookingCollection = decorDB.collection("booking")

        // post operations
        app.post('/services', async(req, res) => {
            const newService = req.body;
            const result = await collection.insertOne(newService)
            res.send(result)
        })

        app.post('/booking', async(req, res) => {
            const newBooking = req.body;
            const result = await bookingCollection.insertOne(newBooking)
            res.send(result)
        })


        //get operations
        app.get('/services', async ( req, res ) => {
            const cursor = collection.find().sort({price: 1})
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/booking', async ( req, res ) => {
            const cursor = bookingCollection.find().sort({price: 1})
            const result = await cursor.toArray()
            res.send(result)
        })

        //get a single 
        app.get('/services/:id', async (req,res) => {
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const result = await collection.findOne(query)
            res.send(result)
        })

        await client.db("admin").command({ ping: 1 });
         console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } 
    finally {
        //  await client.close();
    }
}

run().catch(console.dir)

app.listen(port, () =>{
    console.log(`this server is running on ${port}`);
})


 

// oDiHqEmt7A1Z8f0a
// skeletonDB