require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const uuid = require('uuid'); 
const MongoStore = require('connect-mongo');
const passport = require('passport');7
const cors = require('cors');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer-core');

const app = express();

// Middleware
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
mongoose.connect('mongodb://127.0.0.1:27017/patienty');
// mongoose.connect('mongodb://127.0.0.1:27017/patienty', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

const connection = mongoose.connection;

// Session Store
const mongoStore = MongoStore.create({
  //client: connection.getClient(),
  mongoUrl: 'mongodb://127.0.0.1:27017/patienty',
  collectionName: 'sessions'
});


// Session Config
app.use(session({
  genid: (req) => {
      return uuid.v4(); // Generate a new UUID for each session
  },
  secret: process.env.SESSION_SECRET || 'superman',
  resave: false,
  store: mongoStore,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));



//user schema

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    }
});

const User = mongoose.model("User", userSchema);

// Passport config
const passportInit = require('./app/config/passport');
passportInit(passport);
app.use(passport.initialize());
app.use(passport.session());

// Global Middleware
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.user = req.user;
  next();
});

// CORS

app.use(cors());


require('./routes/web')(app);

app.use("/", require("./routes/auth"));



//patient scheme
const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 0
  },
  gender: {
    type: String,
    required: true,
    enum: ['Male', 'Female', 'Other']
  },
  contact: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid contact number!`
    }
  },
  consultations: [
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    fee: Number,
    date: {
      type: Date,
      default: Date.now
    },
        billed: { type: Boolean, default: false }
  }
]
,
  medicines: [
      {
        medicine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Medicine'
        },
        quantity: {
          type: Number,
          default: 1
        },
        billed: { 
          type: Boolean, default: false
         }

      }
    ],


  // ✅ NEW SCHEME FIELDS
  schemeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme'
  },
  schemeNumber: {
    type: String
  },
  schemeVerified: {
    type: Boolean,
    default: false
  },

  description: {
    type: String
  },
  residentialCategory: {
  type: String,
  enum: ['General', 'Special'],
  default: 'General'
},
  guardianEmail: {
  type: String
}


}, { timestamps: true });

const Patient = mongoose.model('Patient', patientSchema);

//doctor
const doctorSchema = new mongoose.Schema({
  name: String,
  field: String,
  gender: String,
  contact: String,
  consultationFee: {
    type: Number,
    required: true,
    default: 500
  }
});

const Doctor = mongoose.model('Doctor', doctorSchema);

//Medicine
const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  dosage: {
    type: String,
    required: true,
    trim: true
  },
  frequency: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    default: 100
  }
});

const Medicine = mongoose.model('Medicine', medicineSchema);

//roomSchema
const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true
  },
  roomType: {
    type: String,
    enum: ['General', 'Semi-Private', 'ICU'],
    required: true
  },
  dailyRate: {
    type: Number,
    required: true,
    default: 1000
  },
  status: {
    type: String,
    enum: ['Available', 'Occupied'],
    default: 'Available'
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null
  },
  allocatedAt: {
    type: Date
  },
  dischargedAt: {
  type: Date
}

});


const Room = mongoose.model('Room', roomSchema);


//Visitor
const visitorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  visitTime: {
    type: Date,
    required: true
  },
  patientName: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true // patient reference is required
  },
  contact: {
    type: String,
    required: true, // Contact is required
  },
});
const Visitor = mongoose.model('Visitor', visitorSchema);

//schemes
const schemeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,

  coverageType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },

  coverageValue: {
    type: Number,
    required: true
  },

  maxLimit: {
    type: Number
  }

}, { timestamps: true });

const Scheme = mongoose.model('Scheme', schemeSchema);

//billing
const billingSchema = new mongoose.Schema({

  type: {
    type: String,
    enum: ['Residential', 'IPD'],
    required: true
  },
  billingMonth: Number,
  billingYear: Number,

  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },

  ward: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ward'
  },

  // 🏠 RESIDENTIAL ONLY
    residentialDetails: {
      category: String,
      roomRent: Number,
      foodCharge: Number,
      careCharge: Number,
      extraCharge: Number
    }
    ,

  // 🏥 IPD ONLY
  wardDetails: {
    wardCategory: String,
    dailyRate: Number,
    daysStayed: Number,
    roomCharge: Number
  },

  doctorDetails: [
    {
      name: String,
      fee: Number,
      date: Date
    }
  ],

  medicineDetails: [
    {
      name: String,
      price: Number,
      quantity: Number,
      subtotal: Number
    }
  ],

  schemeCoveredAmount: Number,

  totalAmount: Number,
  finalAmount: Number,

  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },
  


}, { timestamps: true });



const Billing = mongoose.model('Billing', billingSchema);


//Ward model for IPD
const wardSchema = new mongoose.Schema({

  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient', // Your existing model (resident)
    required: true
  },

  wardCategory: {
    type: String,
    enum: ['General', 'Semi-Private', 'ICU'],
    required: true
  },

  admissionDate: {
    type: Date,
    default: Date.now
  },

  dischargeDate: {
    type: Date
  },

  status: {
    type: String,
    enum: ['Active', 'Discharged'],
    default: 'Active'
  },

  consultations: [
    {
      doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor'
      },
      fee: Number,
      date: {
        type: Date,
        default: Date.now
      }
    }
  ],

  medicines: [
    {
      medicine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine'
      },
      quantity: Number,
      priceAtTime: Number
    }
  ],

  schemeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scheme'
  },

  schemeVerified: {
    type: Boolean,
    default: false
  },

  coverageUsed: {
    type: Number,
    default: 0
  },

  daysStayed: {
  type: Number
},
  schemeUsedAmount: {
  type: Number,
  default: 0
}



}, { timestamps: true });

const Ward = mongoose.model('Ward', wardSchema);



// Routes
const { isAuth, isAdmin } = require("./middleware/auth");
// Home Page - List Patients
app.get('/', isAuth, async (req, res) => {
  try {
    res.render('home');
  } catch (err) {
    res.status(500).send('Error fetching patients');
  }
});

app.get('/patient', isAuth, isAdmin, async (req, res) => {

  const patients = await Patient.find().populate('consultations.doctor').populate('medicines.medicine').populate('schemeId');

    const doctors = await Doctor.find();   // 👈 ADD THIS


  const updatedPatients = await Promise.all(
    patients.map(async (patient) => {

      const activeWard = await Ward.findOne({
        patient: patient._id,
        status: 'Active'
      });

      return {
        ...patient.toObject(),
        activeWard: activeWard ? true : false
      };
    })
  );

  res.render('patientList', { patients: updatedPatients,    doctorCount: doctors.length   // 👈 SEND COUNT
 });

});



app.get('/viewReport/:id', isAuth, isAdmin, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('consultations.doctor')

      .populate('medicines.medicine');

    const room = await Room.findOne({ patient: patient._id });

    res.render('viewReport', { patient, room });
  } catch (err) {
    res.status(500).send('Error loading report');
  }
});


app.get('/viewReport', isAuth, isAdmin, async (req, res) => {
  const patients = await Patient.find()
    .populate('consultations.doctor')

    .populate('medicines.medicine');

  res.render('viewReport', { patients });
});


// app.get('/report', async (req, res) => {
//   try {
//     const patients = await Patient.find().populate('doctor', 'name field').populate('medicine','name');
//     const doctors = await Doctor.find();
//     const medicines = await Medicine.find();
//     res.render('viewReport', { patients, doctors, medicines });
//   } catch (err) {
//     res.status(500).send('Error fetching patients');
//   }
// });

app.get('/visitor',isAuth, isAdmin, async (req, res) => {
  try {
    const visitors = await Visitor.find().populate('patientName', 'name');
    const patients = await Patient.find();
    res.render('visitorList', { visitors, patients });
  } catch (err) {
    res.status(500).send('Error fetching visitors');
  }
});


app.get('/doctor', isAuth, isAdmin,async (req, res) => {
  try {
      const patients = await Patient.find();
      const doctors = await Doctor.find();
      res.render('doctorList', { patients, doctors });
  } catch (err) {
      res.status(500).send('Error fetching data');
  }
});

app.get('/medicine', isAuth, isAdmin, async (req, res) => {
  try {
      const patients = await Patient.find();
      const doctors = await Doctor.find();
      const medicines = await Medicine.find();
      res.render('medicineList', { patients, doctors, medicines });
  } catch (err) {
      res.status(500).send('Error fetching data');
  }
});


// Add Patient Page
app.get('/addPatient', isAuth, isAdmin,async (req, res) => {
  try {
    const doctors = await Doctor.find({}, 'name field');
    const medicines = await Medicine.find({}, 'name');
    const schemes = await Scheme.find({}, 'name');

    res.render('addPatient', { doctors, medicines, schemes });
  } catch (err) {
    res.status(500).send('Error fetching data');
  }
});

app.post('/addPatient', async (req, res) => {

  const {
    name,
    age,
    gender,
    contact,
    guardianEmail,
    description,
    schemeId,
    schemeNumber,
    schemeVerified,
    residentialCategory
  } = req.body;
  
  let { doctorIds, consultationDates } = req.body;

  if (!Array.isArray(doctorIds)) {
    doctorIds = doctorIds ? [doctorIds] : [];
  }

  if (!Array.isArray(consultationDates)) {
    consultationDates = consultationDates ? [consultationDates] : [];
  }

  const consultations = [];

  for (let i = 0; i < doctorIds.length; i++) {

    const doctorObj = await Doctor.findById(doctorIds[i]);

    consultations.push({
      doctor: doctorIds[i],
      fee: doctorObj ? doctorObj.consultationFee : 0,
      date: consultationDates[i]
        ? new Date(consultationDates[i])
        : new Date()
    });
  }

  const newPatient = new Patient({
    name,
    age,
    gender,
    contact,
    guardianEmail,
    description,
    consultations,
    schemeId: schemeId || null,
    schemeNumber: schemeNumber || null,
    schemeVerified: schemeVerified === 'on',
    residentialCategory
  });

  await newPatient.save();
  res.redirect('/patient');
});



// Add Visitor  Page
app.get('/addVisitor',isAuth, isAdmin, async (req, res) => {
  try {
    const patients = await Patient.find({}, 'name'); // Fetch patient names
    res.render('addVisitor', { patients}); // Pass patients to the view
  } catch (err) {
    res.status(500).send('Error fetching visitors');
  }
});


app.post('/addVisitor', async (req, res) => {
  const { name, patientName, contact, visitTime } = req.body;
  try {
    const newVisitor = new Visitor({  name , patientName, contact, visitTime });
    await newVisitor.save(); 
    res.redirect('/visitor');
  } catch (err) {
    res.status(500).send('Error adding visitor: ' + err.message);
  }
});


//Doctor
app.get('/addDoctor',isAuth, isAdmin, (req, res) => {
  res.render('addDoctor');
});
app.post('/addDoctor', async (req, res) => {
  const { name, field, gender, contact, consultationFee } = req.body;

  const newDoctor = new Doctor({
    name,
    field,
    gender,
    contact,
    consultationFee
  });

  await newDoctor.save();
  res.redirect('/doctor');
});


//Medicine
app.get('/addMedicine',isAuth, isAdmin, (req, res) => {
  res.render('addMedicine');
});
app.post('/addMedicine', async (req, res) => {
  const { name, type, dosage, frequency, price } = req.body;

  const newMedicine = new Medicine({
    name,
    type,
    dosage,
    frequency,
    price
  });

  await newMedicine.save();
  res.redirect('/medicine');
});


// Update Patient Page
app.get('/update/:id',isAuth, isAdmin, async (req, res) => {
  const patient = await Patient.findById(req.params.id)
    .populate('consultations.doctor')

    .populate('medicines.medicine')
    .populate('schemeId');

  const doctors = await Doctor.find();
  const medicines = await Medicine.find();
  const schemes = await Scheme.find();

  res.render('updatePatient', {
    patient,
    doctors,
    medicines,
    schemes
  });
});




app.post('/update/:id', async (req, res) => {

  const {
    name,
    age,
    gender,
    contact,
    guardianEmail,
    description,
    schemeId,
    schemeNumber,
    schemeVerified,
    residentialCategory
  } = req.body;

  try {

    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).send("Patient not found");
    }

    // -------------------------
    // UPDATE PROFILE
    // -------------------------

    patient.name = name;
    patient.age = age;
    patient.gender = gender;
    patient.contact = contact;
    patient.description = description;
    patient.guardianEmail = guardianEmail; // ✔ correct here
    patient.schemeId = schemeId || null;
    patient.schemeNumber = schemeNumber || null;
    patient.schemeVerified = schemeVerified === 'on';
    patient.residentialCategory = residentialCategory;


    // -------------------------
    // UPDATE CONSULTATIONS
    // -------------------------

    let doctorIds = req.body.doctorIds || [];
    let dates = req.body.consultationDates || [];

    if (!Array.isArray(doctorIds)) doctorIds = [doctorIds];
    if (!Array.isArray(dates)) dates = [dates];

    patient.consultations = [];

    for (let i = 0; i < doctorIds.length; i++) {

      if (!doctorIds[i]) continue;

      const doctor = await Doctor.findById(doctorIds[i]);
      if (!doctor) continue;

      patient.consultations.push({
        doctor: doctor._id,
        fee: doctor.consultationFee,
        date: dates[i] ? new Date(dates[i]) : new Date(),
        billed: false
      });
    }


    // -------------------------
    // UPDATE MEDICINES
    // -------------------------

    let medicineIds = req.body.medicineIds || [];
    let quantities = req.body.quantities || [];

    if (!Array.isArray(medicineIds)) medicineIds = [medicineIds];
    if (!Array.isArray(quantities)) quantities = [quantities];

    patient.medicines = [];

    for (let i = 0; i < medicineIds.length; i++) {

      if (!medicineIds[i]) continue;

      const medicine = await Medicine.findById(medicineIds[i]);
      if (!medicine) continue;

      patient.medicines.push({
        medicine: medicine._id,
        quantity: quantities[i] || 1,
        billed: false
      });
    }

    // -------------------------
    // SAVE
    // -------------------------

    await patient.save();

    res.redirect('/patient');

  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating patient");
  }

});




// Update Visitor Page
app.get('/update/visitors/:id',isAuth, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const visitors = await Visitor.findById(id).populate('patientName', 'name');
    const patients = await Patient.find({}, 'name'); // Fetch all Patients with their names
    res.render('updateVisitor', { visitors, patients});
  } catch (err) {
    res.status(500).send('Error fetching visitors details');
  }
});


app.post('/update/visitors/:id', async (req, res) => {
  const { id } = req.params;
  const { name, patientName, visitTime, contact } = req.body;
  try {
    await Visitor.findByIdAndUpdate(id, { name, patientName, visitTime, contact });
    res.redirect('/visitor');
  } catch (err) {
    console.error('Error updating visitor:', err);
    res.status(500).send('Error updating visitor details');
  }
});


// Update Doctor Page
app.get('/update/doctor/:id',isAuth, isAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const doctor = await Doctor.findById(id);
    res.render('updateDoctor', { doctor });
  } catch (err) {
    res.status(500).send('Error fetching doctor details');
  }
});

app.post('/update/doctor/:id', async (req, res) => {
  const { id } = req.params;
  const { name, field, gender, contact, consultationFee } = req.body;

  await Doctor.findByIdAndUpdate(id, {
    name,
    field,
    gender,
    contact,
    consultationFee
  });

  res.redirect('/doctor');
});


// Update Medicine Page
app.get('/update/medicine/:id',isAuth, isAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const medicine = await Medicine.findById(id);
    res.render('updateMedicine', { medicine });
  } catch (err) {
    res.status(500).send('Error fetching Medicine details');
  }
});

app.post('/update/medicine/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, dosage, frequency, price } = req.body;

  await Medicine.findByIdAndUpdate(id, {
    name,
    type,
    dosage,
    frequency,
    price
  });

  res.redirect('/medicine');
});


//room
app.get('/addRoom', isAuth, isAdmin,(req, res) => {
  res.render('addRoom');
});

app.post('/addRoom', async (req, res) => {
  const { roomNumber, roomType, dailyRate } = req.body;

  const room = new Room({
    roomNumber,
    roomType,
    dailyRate
  });

  await room.save();
  res.redirect('/rooms');
});


app.get('/rooms',isAuth, isAdmin, async (req, res) => {
  const rooms = await Room.find().populate('patient', 'name');
  const patients = await Patient.find();
  res.render('roomList', { rooms, patients });
});

app.post('/allocateRoom/:id', async (req, res) => {
  const { patientId } = req.body;

  await Room.findByIdAndUpdate(req.params.id, {
    status: 'Occupied',
    patient: patientId,
    allocatedAt: new Date(),
    dischargedAt: null
  });

  res.redirect('/rooms');
});




//update room status to available
app.get('/updateRoom/:id',isAuth, isAdmin, async (req, res) => {
  const room = await Room.findById(req.params.id);
  res.render('updateRoom', { room });
});

app.post('/updateRoom/:id', async (req, res) => {

  const {
    roomNumber,
    roomType,
    status,
    dailyRate,
    allocatedAt
  } = req.body;

  const updateData = {
    roomNumber,
    roomType,
    status,
    dailyRate,
    allocatedAt: allocatedAt || null
  };

  // If manually changing status to Available,
  // auto set discharge time
  if (status === 'Available') {
    updateData.patient = null;
    updateData.dischargedAt = new Date();
  }

  await Room.findByIdAndUpdate(req.params.id, updateData);

  res.redirect('/rooms');
});




//discharge room
app.post('/discharge/:roomId', async (req, res) => {

  const room = await Room.findById(req.params.roomId);

  if (!room || room.status === 'Available') {
    return res.redirect('/rooms');
  }

  room.status = 'Available';
  room.dischargedAt = new Date();
  room.patient = null;

  await room.save();

  res.redirect('/rooms');
});






//schemes:
app.get('/schemes', isAuth, isAdmin,async (req, res) => {
  try {
    const schemes = await Scheme.find();
    res.render('schemeList', { schemes });
  } catch (err) {
    res.status(500).send('Error fetching schemes');
  }
});

// Add Scheme Page
app.get('/addScheme', isAuth, isAdmin,(req, res) => {
  res.render('addScheme');
});

app.post('/addScheme', async (req, res) => {
  const { name, description, coverageType, coverageValue, maxLimit } = req.body;

  try {
    const scheme = new Scheme({
      name,
      description,
      coverageType,
      coverageValue,
      maxLimit
    });

    await scheme.save();
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Error adding scheme');
  }
});

//update scheme
app.get('/updateScheme/:id', isAuth, isAdmin,async (req, res) => {
  const scheme = await Scheme.findById(req.params.id);
  res.render('updateScheme', { scheme });
});

app.post('/updateScheme/:id', async (req, res) => {
  const { name, description, coverageType, coverageValue, maxLimit } = req.body;

  await Scheme.findByIdAndUpdate(req.params.id, {
    name,
    description,
    coverageType,
    coverageValue,
    maxLimit
  });

  res.redirect('/schemes');
});




//email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD
  }
});

async function generateInvoicePDF(bill) {

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true
  });

  const page = await browser.newPage();

  const html = await new Promise((resolve, reject) => {
    app.render('invoice', { bill }, (err, html) => {
      if (err) reject(err);
      else resolve(html);
    });
  });

  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true
  });

  await browser.close();

  return pdfBuffer;
}


//billing
app.get('/billing', isAuth, isAdmin,async (req, res) => {
  const patients = await Patient.find().populate('schemeId');
  res.render('billing', { patients });
});


app.post('/billing', async (req, res) => {

  try {

    const { patientId, foodCharge, careCharge, extraCharge } = req.body;

    const patient = await Patient.findById(patientId)
      .populate('consultations.doctor')
      .populate('medicines.medicine');

    if (!patient) return res.send("Resident not found");

    // Prevent residential billing if IPD active
    const activeWard = await Ward.findOne({
      patient: patient._id,
      status: 'Active'
    });

    if (activeWard) {
      return res.send("Resident is admitted in IPD. Generate IPD bill.");
    }

    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    // 🔥 DELETE OLD PENDING BILL (ALLOW OVERRIDE)

    // const unpaidBill = await Billing.findOne({
    //   patient: patient._id,
    //   type: 'Residential',
    //   billingMonth: month,
    //   billingYear: year,
    //   paymentStatus: 'Pending'
    // });

    // if (unpaidBill) {
    //   await Billing.findByIdAndDelete(unpaidBill._id);
    // }

    // const paidBillExists = await Billing.findOne({
    //   patient: patient._id,
    //   type: 'Residential',
    //   billingMonth: month,
    //   billingYear: year,
    //   paymentStatus: 'Paid'
    // });

    const unbilledConsultations = patient.consultations.filter(c => !c.billed);
    const unbilledMedicines = patient.medicines.filter(m => !m.billed);

    // if (!paidBillExists &&
    //     unbilledConsultations.length === 0 &&
    //     unbilledMedicines.length === 0) {

    //   return res.send("Nothing new to bill.");
    // }

    const alreadyGenerated = await Billing.findOne({
      patient: patient._id,
      type: 'Residential',
      billingMonth: month,
      billingYear: year
    });

      if (alreadyGenerated) {
      alreadyGenerated.isLatest = false;
      await alreadyGenerated.save();
    }

    // -------------------------
    // BASE CHARGES (ONLY IF NOT PAID THIS MONTH)
    // -------------------------

    let roomRent = 0;
    let food = 0;
    let care = 0;
    let extra = 0;

    // if (!paidBillExists) {

      if (patient.residentialCategory === 'General') {
        roomRent = 6000;
      }

      if (patient.residentialCategory === 'Special') {
        roomRent = 12000;
      }

      food = Number(foodCharge) || 4000;
      care = Number(careCharge) || 13000;
      extra = Number(extraCharge) || 2400;
    // }

    // -------------------------
    // DOCTOR TOTAL (UNBILLED ONLY)
    // -------------------------

    let doctorTotal = 0;
let doctorMap = {};

// Merge same doctors
unbilledConsultations.forEach(c => {

  if (!c.doctor) return;

  const name = c.doctor.name;
  const fee = Number(c.fee) || 0;

  if (!doctorMap[name]) {
    doctorMap[name] = {
      name,
      visitCount: 0,
      totalFee: 0
    };
  }

  doctorMap[name].visitCount += 1;
  doctorMap[name].totalFee += fee;
});

// Convert map to array
let doctorSnapshots = Object.values(doctorMap);

// Calculate total
doctorSnapshots.forEach(d => {
  doctorTotal += d.totalFee;
});

    // -------------------------
    // MEDICINE TOTAL (UNBILLED ONLY)
    // -------------------------

let medicineTotal = 0;
let medicineMap = {};

// Merge same medicines
unbilledMedicines.forEach(item => {

  if (!item.medicine) return;

  const name = item.medicine.name;
  const price = Number(item.medicine.price) || 0;
  const qty = Number(item.quantity) || 0;

  if (!medicineMap[name]) {
    medicineMap[name] = {
      name,
      price,
      quantity: 0,
      subtotal: 0
    };
  }

  medicineMap[name].quantity += qty;
  medicineMap[name].subtotal += price * qty;
});

// Convert map to array
let medicineSnapshots = Object.values(medicineMap);

// Calculate total
medicineSnapshots.forEach(m => {
  medicineTotal += m.subtotal;
});

    // -------------------------
    // TOTAL
    // -------------------------

    const total =
      roomRent +
      food +
      care +
      extra +
      doctorTotal +
      medicineTotal;

    if (total <= 0) {
      return res.send("No new charges to bill.");
    }

    // -------------------------
    // SAVE BILL (DO NOT DELETE OLD ONES)
    // -------------------------

    const bill = new Billing({
      type: 'Residential',
      patient: patient._id,
      billingMonth: month,
      billingYear: year,

      residentialDetails: {
      category: patient.residentialCategory,
      roomRent,
      foodCharge: food,
      careCharge: care,
      extraCharge: extra
    },

      doctorDetails: doctorSnapshots.map(d => ({
      name: `${d.name} (${d.visitCount} Visit${d.visitCount > 1 ? 's' : ''})`,
      fee: d.totalFee
    })),

      medicineDetails: medicineSnapshots,

      totalAmount: total,
      finalAmount: total,
      paymentStatus: 'Pending'
    });

    await bill.save();

    res.redirect('/billingList?type=Residential');

  } catch (err) {
    console.error(err);
    res.status(500).send("Residential billing failed");
  }

});




app.get('/billingList',isAuth, isAdmin, async (req, res) => {

  const type = req.query.type;

  let filter = {};

  if (type) {
    filter.type = type;
  }

  const bills = await Billing.find(filter).populate('patient');

  res.render('billingList', { bills });

});




//paidbill and pdf bill
app.post('/markPaid/:id', async (req, res) => {

  const bill = await Billing.findById(req.params.id)
    .populate('patient');

  if (!bill) return res.redirect('/billingList');

  bill.paymentStatus = 'Paid';
  await bill.save();

  const patient = await Patient.findById(bill.patient._id);

  if (bill.type === 'Residential') {

    patient.consultations.forEach(c => {
      if (!c.billed) c.billed = true;
    });

    patient.medicines.forEach(m => {
      if (!m.billed) m.billed = true;
    });

    await patient.save();
  }

  res.redirect('/billingList');
});

 

app.get('/invoice/:id', isAuth, isAdmin,async (req, res) => {

  try {

    const bill = await Billing.findById(req.params.id)
      .populate('patient');

    if (!bill) {
      return res.status(404).send("Invoice not found");
    }

    const html = await new Promise((resolve, reject) => {
      res.render('invoice', { bill }, (err, html) => {
        if (err) reject(err);
        else resolve(html);
      });
    });

    const browser = await puppeteer.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=invoice.pdf");
    res.setHeader("Content-Length", pdf.length);

    res.end(pdf);

  } catch (err) {
    console.error("Invoice Error:", err);
    res.status(500).send("PDF generation failed");
  }

});


//ward details

//Admit to Ward Route
app.post('/ward/admit/:patientId', async (req, res) => {

  const { wardCategory } = req.body;

  // Check if already active ward
  const existing = await Ward.findOne({
    patient: req.params.patientId,
    status: 'Active'
  });

  if (existing) {
    return res.send("Patient already admitted.");
  }

  const ward = new Ward({
    patient: req.params.patientId,
    wardCategory
  });

  await ward.save();

  res.redirect('/ward/active');
});

//view active wards
app.get('/ward/active',isAuth, isAdmin, async (req, res) => {

  const wards = await Ward.find({ status: 'Active' })
    .populate('patient')
    .populate('consultations.doctor')
    .populate('medicines.medicine')
    .populate('schemeId');

  res.render('wardList', { wards });
});

//discharge from ward
app.post('/ward/discharge/:id', async (req, res) => {

  const ward = await Ward.findById(req.params.id);

  const dischargeDate = new Date();

  const daysStayed = Math.ceil(
    (dischargeDate - ward.admissionDate) / (1000 * 60 * 60 * 24)
  );

  ward.status = 'Discharged';
  ward.dischargeDate = dischargeDate;
  ward.daysStayed = daysStayed < 1 ? 1 : daysStayed;

  await ward.save();

  res.redirect('/ward/view/' + ward._id);

});


//admitWard
app.get('/ward/admit/:patientId',isAuth, isAdmin, async (req, res) => {

  const patient = await Patient.findById(req.params.patientId);

  res.render('admitWard', { patient });

});

app.get('/ward/view/:id',isAuth, isAdmin, async (req, res) => {

  const ward = await Ward.findById(req.params.id)
    .populate('patient')
    .populate('consultations.doctor')
    .populate('medicines.medicine')
    .populate('schemeId');

  const doctors = await Doctor.find();
  const medicines = await Medicine.find();
  const schemes = await Scheme.find();

  res.render('wardDetails', { ward, doctors, medicines, schemes });

});




//add consultation to ward
app.post('/ward/addConsultation/:id', async (req, res) => {

  const ward = await Ward.findById(req.params.id);
  const doctor = await Doctor.findById(req.body.doctorId);

  ward.consultations.push({
    doctor: doctor._id,
    fee: doctor.consultationFee
  });

  await ward.save();

  res.redirect('/ward/view/' + ward._id);
});

//medicine to ward
app.post('/ward/addMedicine/:id', async (req, res) => {

  const ward = await Ward.findById(req.params.id);
  const medicine = await Medicine.findById(req.body.medicineId);

  ward.medicines.push({
    medicine: medicine._id,
    quantity: req.body.quantity,
    priceAtTime: medicine.price
  });

  await ward.save();

  res.redirect('/ward/view/' + ward._id);
});

// attach scheme to ward
app.post('/ward/attachScheme/:id', async (req, res) => {

  const { schemeId, schemeVerified } = req.body;

  await Ward.findByIdAndUpdate(req.params.id, {
    schemeId: schemeId || null,
    schemeVerified: schemeVerified === 'on'
  });

  res.redirect('/ward/view/' + req.params.id);

});

//ward billing
// app.post('/billing', async (req, res) => {

//   const { patientId } = req.body;

//   const patient = await Patient.findById(patientId);
//   if (!patient) return res.send("Resident not found");

//   // Prevent residential billing if IPD active
//   const activeWard = await Ward.findOne({
//     patient: patient._id,
//     status: 'Active'
//   });

//   if (activeWard) {
//     return res.send("Resident is admitted in IPD. Generate IPD bill.");
//   }

//   // SAFE NUMBERS
//   const monthly = Number(req.body.monthlyCharge) || 0;
//   const food = Number(req.body.foodCharge) || 0;
//   const care = Number(req.body.careCharge) || 0;
//   const extra = Number(req.body.extraCharge) || 0;

//   const total = monthly + food + care + extra;

//   if (isNaN(total)) {
//     return res.send("Invalid residential billing data");
//   }

//   const bill = new Billing({
//     type: 'Residential',
//     patient: patient._id,

//     residentialDetails: {
//       monthlyCharge: monthly,
//       foodCharge: food,
//       careCharge: care,
//       extraCharge: extra
//     },

//     totalAmount: total,
//     finalAmount: total
//   });

//   await bill.save();

//   res.redirect('/billingList');
// });

// IPD Billing
app.get('/ward/generateBill/:id', isAuth, isAdmin,async (req, res) => {

  const ward = await Ward.findById(req.params.id)
    .populate('patient')
    .populate('consultations.doctor')
    .populate('medicines.medicine')
    .populate('schemeId');

  if (!ward) return res.send("Ward not found");
  const existing = await Billing.findOne({
  ward: ward._id,
  type: 'IPD'
});

if (existing) {
  return res.redirect('/billingList');
}

  const dischargeDate = ward.dischargeDate || new Date();

  const daysStayed = Math.ceil(
    (dischargeDate - ward.admissionDate) / (1000 * 60 * 60 * 24)
  ) || 1;

  let dailyRate = 2000;

  if (ward.wardCategory === 'General') dailyRate = 1500;
  if (ward.wardCategory === 'Semi-Private') dailyRate = 3000;
  if (ward.wardCategory === 'ICU') dailyRate = 5400;

  const roomCharge = (Number(dailyRate) || 0) * (Number(daysStayed) || 0);

  let doctorTotal = 0;
  ward.consultations.forEach(c => {
    doctorTotal += Number(c.fee) || 0;
  });

  let medicineTotal = 0;
  ward.medicines.forEach(m => {
    if (m.medicine) {
      medicineTotal +=
        (Number(m.medicine.price) || 0) *
        (Number(m.quantity) || 0);
    }
  });

  const grossTotal = roomCharge + doctorTotal + medicineTotal;

  let schemeCoveredAmount = 0;
  let finalAmount = grossTotal;

  if (ward.schemeId && ward.schemeVerified) {

    schemeCoveredAmount = roomCharge + medicineTotal;

    const maxLimit = 500000;
    const remaining = maxLimit - (ward.schemeUsedAmount || 0);

    if (schemeCoveredAmount > remaining) {
      schemeCoveredAmount = remaining;
    }

    ward.schemeUsedAmount =
      (ward.schemeUsedAmount || 0) + schemeCoveredAmount;

    await ward.save();

    finalAmount = grossTotal - schemeCoveredAmount;
  }

  const bill = new Billing({
    type: 'IPD',
    patient: ward.patient._id,
    ward: ward._id,

    wardDetails: {
      wardCategory: ward.wardCategory,
      dailyRate,
      daysStayed,
      roomCharge
    },

    doctorDetails: ward.consultations.map(c => ({
      name: c.doctor ? c.doctor.name : '',
      fee: c.fee,
      date: c.date
    })),

    medicineDetails: ward.medicines.map(m => ({
      name: m.medicine ? m.medicine.name : '',
      price: m.medicine ? m.medicine.price : 0,
      quantity: m.quantity,
      subtotal: m.medicine
        ? m.medicine.price * m.quantity
        : 0
    })),

    schemeCoveredAmount,
    totalAmount: grossTotal,
    finalAmount
  });

  await bill.save();



  res.redirect('/billingList');
});

// Update Admission & Discharge Dates
app.post('/ward/updateDates/:id', async (req, res) => {

  const { admissionDate, dischargeDate } = req.body;

  const ward = await Ward.findById(req.params.id);
  if (!ward) return res.send("Ward not found");

  if (admissionDate) {
    ward.admissionDate = new Date(admissionDate);
  }

  if (dischargeDate) {
    ward.dischargeDate = new Date(dischargeDate);
    ward.status = 'Discharged';

    const daysStayed = Math.ceil(
      (ward.dischargeDate - ward.admissionDate) / (1000 * 60 * 60 * 24)
    );

    ward.daysStayed = daysStayed < 1 ? 1 : daysStayed;
  }

  await ward.save();

  res.redirect('/ward/view/' + ward._id);
});

//ipd billing
app.get('/billing/ipd',isAuth, isAdmin, async (req, res) => {
  const dischargedWards = await Ward.find({ status: 'Discharged' })
    .populate({
      path: 'patient',
      populate: { path: 'schemeId' } // This line is critical to get the name
    });

  res.render('ipdBilling', { wards: dischargedWards });
});

app.post('/sendBill/:id', async (req, res) => {

  const bill = await Billing.findById(req.params.id)
    .populate('patient');

  if (!bill || !bill.patient.guardianEmail) {
    return res.redirect('/billingList');
  }

  const pdf = await generateInvoicePDF(bill);

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: bill.patient.guardianEmail,
    subject: `Invoice - ${bill.type}`,
    html: `
      <h2>Invoice Details</h2>
      <h3>Type: ${bill.type}</h3>
      <p>Total Amount: ₹${bill.totalAmount}</p>
      <p>Final Amount: ₹${bill.finalAmount}</p>
      <p>Scheme Covered: ₹${bill.schemeCoveredAmount || 0}</p>
      <p>Generated On: ${bill.createdAt.toDateString()}</p>
      <hr>
      <h4>Patient Details</h4>
      <p>Patient: ${bill.patient.name}</p>
      <p>Contact: ${bill.patient.contact}</p>
      <p>Guardian Email: ${bill.patient.guardianEmail}</p>
      <hr>
      <h4>Payment Status</h4>
      <p>Status: ${bill.paymentStatus}</p>
      <hr>
      <h4>Breakdown</h4>
      <p>Room Charge: ₹${bill.wardDetails ? bill.wardDetails.roomCharge : 0}</p>
      <p>Doctor Fees: ₹${bill.doctorDetails.reduce((sum, d) => sum + (d.fee || 0), 0)}</p>
      <p>Medicine Charges: ₹${bill.medicineDetails.reduce((sum, m) => sum + (m.subtotal || 0), 0)}</p>
      <p>Other Charges: ₹${bill.residentialDetails ? (bill.residentialDetails.foodCharge + bill.residentialDetails.careCharge + bill.residentialDetails.extraCharge) : 0}</p>
      <hr>
      <h4>Generated Invoice</h4>
      <h4>Note</h4>
  
      <p>This is an auto-generated invoice from the Elderly Care Facility Management System.</p>
      
    `,
    attachments: [{
      filename: `Invoice-${bill._id}.pdf`,
      content: pdf
    }]
  });

  res.redirect('/billingList');
});

//add consultation to ward
app.get('/patient/:id/addConsultation',isAuth, isAdmin, async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  const doctors = await Doctor.find();
  res.render('addConsultation', { patient, doctors });
});

app.post('/patient/:id/addConsultation', async (req, res) => {

  const patient = await Patient.findById(req.params.id);
  const doctor = await Doctor.findById(req.body.doctorId);

  patient.consultations.push({
    doctor: doctor._id,
    fee: doctor.consultationFee,
    date: new Date(),
    billed: false
  });

  await patient.save();

  res.redirect('/patient');
});

//add medicine to patient


app.get('/patient/:id/addMedicine',isAuth, isAdmin, async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  const medicines = await Medicine.find();
  res.render('addMedicineToPatient', { patient, medicines });
});
app.post('/patient/:id/addMedicine', async (req, res) => {

  const patient = await Patient.findById(req.params.id);
  const medicine = await Medicine.findById(req.body.medicineId);

  patient.medicines.push({
    medicine: medicine._id,
    quantity: req.body.quantity,
    billed: false
  });

  await patient.save();

  res.redirect('/patient');
});



// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
