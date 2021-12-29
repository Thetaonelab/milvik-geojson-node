const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require("fs");
const axios = require("axios").default;
const {parse} = require('csv-parse');
const {apiKey} = require('./constants');

const app = express()
  .use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
  .use(bodyParser.json({ limit: '50mb' }));

const port = 3000;

app.use(express.json());
app.use(cors());

checkPresent = (caches,shop_address) => {
  try{
    for(let i=0;i<caches.length;i=i+1){
      if(caches[i].shop_address===shop_address){
        return {name:caches[i].name,shop_address:caches[i].shop_address,address:caches[i].address,position:caches[i].address?caches[i].position:null};
      }
    }
    return false;
  }catch(err){
    console.error(err);
    return false;
  }
}

app.post("/get-location",(req,res)=>{
    fs.readFile("data.json", async (err, data) => {
        // Check for errors
        if (err) throw err;
        // Converting to JSON
        let features=[];
        const shops = JSON.parse(data);
        for(let i=0;i<50001;i=i+1){
            console.log(i);
            await axios.get(
                `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(shops[i].shop_address)}&apiKey=k1oGgG0PQbBrSsfmUlzcLkaQ0ERCV3-PsLzBj_zYM5k`
                )
            .then(response => {
                console.log(response.data.items[0]);
                    features.push({
                        type: "Feature",
                        geometry: {
                          type: "Point",
                          coordinates: [response.data.items[0].position.lng,response.data.items[0].position.lat ]
                        },
                        properties: {
                          name: shops[i].shop_name
                        }
                      });
                })
                .catch((err) => {
                    console.error(err,shops[i].shop_name);
                });
        }
        console.log(features.length);
        features={
            type: "FeatureCollection",
            features
        };
        fs.writeFile("results50000.json", JSON.stringify(features), err => {
            // Checking for errors
            if (err) throw err; 
            console.log("Done writing"); // Success
        });
        res.json({sucess:true,result:features});
    });
});

app.post("/create-csv",(req,res)=>{
  const{upper,lower}=req.body;
  let fileExists=false;
  let prevCaches = [];

  fs.readFile("data.json", async (err, data) => {
    // Check for errors
    if (err) throw err;
    // Converting to JSON
    const shops = JSON.parse(data);
    let writeStream = fs.createWriteStream(`results${lower}_${upper}.csv`);
    let caches = [];
    let newLine = [];
    newLine.push("Agent Name");
    newLine.push("Address");
    newLine.push("District");
    newLine.push("City")
    newLine.push("Latitude");
    newLine.push("Longitude");
    writeStream.write(newLine.join(',')+ '\n', () => {});
    try {
      if (fs.existsSync("cache.json")) {
        //file exists
        fileExists=true;
      }
    } catch(err) {
      console.error(err)
    }
    if(fileExists){
      fs.writeFile("cache.json", JSON.stringify(prevCaches), err => {
        // Checking for errors
        if (err) throw err; 
        console.log("Done writing"); // Success
      });
    }
    fs.readFile("cache.json", async (err, data) => {
      // Check for errors
      if (err) throw err;
      // Converting to JSON
      prevCaches = JSON.parse(data);
      for(let index=lower;index<upper;index=index+1){
        let cacheCheck = await checkPresent(prevCaches,shops[index].shop_address);
        if(!cacheCheck)
        {
          await axios.get(
            `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(shops[index].shop_address+',Bangladesh')}&apiKey=${apiKey}`
            )
          .then(response => {
            const{address,position}=response.data.items[0];
            newLine = []
            prevCaches.push({name:shops[index].shop_name,shop_address:shops[index].shop_address,address,position});
            newLine.push(shops[index].shop_name);
            newLine.push(address.label.replace(/,/g,"-"));
            newLine.push(address.district?address.district:address.city);
            newLine.push(address.city);
            newLine.push(position.lat);
            newLine.push(position.lng);
            writeStream.write(newLine.join(',')+ '\n', () => {})
            })
            .catch((err) => {
                console.error(err,shops[index].shop_name);
                caches.push({name:shops[index].shop_name,shop_address:shops[index].shop_address,address:null});
          });
        } else {
          if(cacheCheck.address){
            newLine = []
            newLine.push(cacheCheck.name);
            newLine.push(cacheCheck.address.label.replace(/,/g,"-"));
            newLine.push(cacheCheck.address.district?cacheCheck.address.district:cacheCheck.address.city);
            newLine.push(cacheCheck.address.city);
            newLine.push(cacheCheck.position.lat);
            newLine.push(cacheCheck.position.lng);
            writeStream.write(newLine.join(',')+ '\n', () => {})
          }
        }
      }
      writeStream.end()
      writeStream.on('finish', () => {
        console.log('finish write stream, moving along')
      }).on('error', (err) => {
        console.log(err)
      })
      fs.writeFile("cache.json", JSON.stringify(prevCaches), err => {
        // Checking for errors
        if (err) throw err; 
        console.log("Done writing"); // Success
      });
    });

    res.json({sucess:true});
  });
  
});

app.listen(port, () =>
  console.log(`Milvik Geo Location ${port}!`)
);