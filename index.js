const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();
const port = process.env.PORT || 3000;
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const admin = require("firebase-admin");

const serviceAccount = require("./style-decor-d89db-firebase-adminsdk-fbsvc-bf21d628a1.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middlewere
app.use(cors());
app.use(express.json());
const varifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decode = await admin.auth().verifyIdToken(idToken);
    console.log("decoded", decode);
    req.decode_email = decode.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.VITE_userName}:${process.env.VITE_password}@tanvir369.ymezqkm.mongodb.net/?appName=Tanvir369`;
function generateTrackingId() {
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TRK-${time}-${random}`;
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("the server is running from port 3000");
});

async function run() {
  try {
    await client.connect();

    const decorDB = client.db("styleDecor");
    const usercollection = decorDB.collection("users");
    const decoratorCollection = decorDB.collection("Decorator");
    const collection = decorDB.collection("services");
    const bookingCollection = decorDB.collection("booking");
    const paymentCollection = decorDB.collection("payments");

    // middlewere for admin
    const varifyAdmin = async(req, res, next) =>{
      const email = req.decode_email
      const query = {email}
      const user = await usercollection.findOne(query)

      if(!user || user.role !== "Admin"){
        return res.status(403).send({message: "Forbidden"})
      }
      next()
    }


    // user related Api
    app.post("/users", async (req, res) => {
      const user = req.body;
      (user.role = "user"), (user.createdAt = new Date());
      const email = user.email;
      const userExists = await usercollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user already exists" });
      }

      const result = await usercollection.insertOne(user);
      res.send(result);
    });


     app.get("/users", async (req, res) => {
      const cursor = usercollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

     app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email
      const query = { email }
      const user = await usercollection.findOne(query);
      res.send({role: user?.role || "user"});
    });


    app.patch("/users/:id/role", varifyFBToken, varifyAdmin, async (req, res) => {
      const role = req.body.role;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: role,
        },
      };
      const result = await usercollection.updateOne(query, updatedDoc);
      res.send(result)
    });

    // Decorators related API
    app.get("/decorator", async (req, res) => {
      const {status, currentStatus} = req.query;
      const query = {};
      if (status) {
        query.status = status;
      }
      if(currentStatus){
        query.currentStatus = currentStatus;
      }
      const cursor = decoratorCollection.find(query).sort({applicationDate: -1});
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/decorator", async (req, res) => {
      const decorator = req.body;
      const email = req.body.email;
      const alreadyExists = await decoratorCollection.findOne({ email });
      if (alreadyExists) {
        return res.send({ message: "already exists" });
      }
      const result = await decoratorCollection.insertOne(decorator);
      res.send(result);
    });

    app.patch("/decorator/:id", varifyFBToken, async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: status,
          currentStatus: "Available"
        },
      };
      const result = await decoratorCollection.updateOne(query, updatedDoc);

      if(status === "Approved"){
        const email = req.body.email
        const userQuery = {email}
        const UpdateRole = {
          $set: {
            role: 'Decorator'
          }
        }
        const userResult = await usercollection.updateOne(userQuery, UpdateRole);
      }

      res.send(result);
    });

    app.delete("/decorator/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await decoratorCollection.deleteOne(query);
      res.send(result);
    });

    // post operations
    app.post("/services", async (req, res) => {
      const newService = req.body;
      const result = await collection.insertOne(newService);
      res.send(result);
    });

    app.post("/booking", async (req, res) => {
      const newBooking = req.body;
      const result = await bookingCollection.insertOne(newBooking);
      res.send(result);
    });

    //get operations
    app.get("/services", async (req, res) => {
      const cursor = collection.find().sort({ price: 1 });
      const result = await cursor.toArray();
      res.send(result);
    });


    app.get("/booking", async (req, res) => {
      const query = {};
      const {email, workStatus} = req.query;
      if(email){
        query.userEmail = email;
      }

      if(workStatus){
        query.workStatus = {$in: ['Pending', 'Rejected']}
      } 

      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    //get a single
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await collection.findOne(query);
      res.send(result);
    });

    app.get('/booking/decorator', async(req, res) => {
      const {decoratorEmail, workStatus} = req.query;
      const query = {}
      if(decoratorEmail){
        query.decoratorEmail = decoratorEmail
      }
      if(workStatus){
        query.workStatus = {$in: ['Decorator_Assigned', 'Accepted']}
      }
      const cursor = bookingCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/booking/complete', async(req, res) => {
      const {decoratorEmail, workStatus} = req.query;
      const query = {}
      if(decoratorEmail){
        query.decoratorEmail = decoratorEmail
      }
      if(workStatus){
        query.workStatus = ("Completed")
      }
      const cursor = bookingCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.patch("/booking/:id", async (req, res) => {
      const { decoratorId, decoratorName, decoratorEmail } = req.body
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          workStatus: "Decorator_Assigned",
          decoratorId: decoratorId,
          decoratorName: decoratorName,
          decoratorEmail: decoratorEmail,
        }
      }
      const result = await bookingCollection.updateOne(query, update)
      console.log(result);
      
      
      // update decorator info
      const decoratorQuery = { _id: new ObjectId(decoratorId) }
      const decoratorUpdate = {
        $set: {
          currentStatus: "On-Assignment"
        }
      }
      const decoratorResult = await decoratorCollection.updateOne(decoratorQuery, decoratorUpdate)
      res.send(decoratorResult)
    });


        app.patch("/decorator/:id/status", async(req, res) => {
        const {currentStatus} = req.body
        const query = {_id: new ObjectId(req.params.id)}
        const updateInfo = {
          $set: {
            currentStatus: currentStatus,
          }
        }
        const result = await decoratorCollection.updateOne(query, updateInfo)
        res.send(result)
    })


    app.patch("/booking/:id/status", async(req, res) => {
        const {workStatus} = req.body
        const query = {_id: new ObjectId(req.params.id)}
        const updateInfo = {
          $set: {
            workStatus: workStatus,
          }
        }
        const result = await bookingCollection.updateOne(query, updateInfo)
        res.send(result)
    })

    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    // delete item
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // payment related API

    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "BDT",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.serviceName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.email,
        mode: "payment",
        metadata: {
          packageName: paymentInfo.serviceName,
          packageId: paymentInfo.packageId,
        },
        success_url: `${process.env.SUCCESS_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SUCCESS_URL}/dashboard/payment-canceled`,
      });

      console.log(session);
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log("session retrived", session);
      console.log("metadata", session.metadata);

      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };

      const paymentExists = await paymentCollection.findOne(query);

      if (paymentExists) {
        return res.send({ message: "already exists" });
      }

      if (session.payment_status === "paid") {
        const id = session.metadata.packageId;
        const trackingId = generateTrackingId();
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            status: "Paid",
            workStatus: "Pending",
            trackingId: trackingId,
          },
        };

        const result = await bookingCollection.updateOne(query, update);

        const payment = {
          amountTotal: session.amount_total,
          currency: session.currency,
          customerEmail: session.customer_email,
          packageId: session.metadata.packageId,
          serviceName: session.metadata.packageName,
          transactionId: session.payment_intent,
          PaymentStatus: session.payment_status,
          trackingId: trackingId,
          paidAt: new Date(),
        };

        if (session.payment_status === "paid") {
          const paymentResult = await paymentCollection.insertOne(payment);
          res.send({
            success: true,
            modifyParcel: result,
            trackingId: trackingId,
            transactionId: session.payment_intent,
            paymentInfo: paymentResult,
          });
        }
      }
    });

    app.get("/payments", varifyFBToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.customerEmail = email;

        if (email !== req.decode_email) {
          return res.status(403).send({ message: "forbidden access" });
        }
      }
      const cursor = paymentCollection.find(query).sort({ paidAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.delete("/payments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    //  await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`this server is running on ${port}`);
});
