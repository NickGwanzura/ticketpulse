export const TRANSPORT_DEMO_OPERATOR = {
  companyName: "Pulse Luxury Coaches",
  contactPerson: "Tendai Moyo",
  email: "operations@pulseluxury.co.zw",
  phone: "+263 77 555 0198",
  verificationStatus: "Pending document review",
  payoutMethod: "Bank settlement",
}

export const TRANSPORT_DEMO_ROUTE = {
  origin: "Harare",
  destination: "Bulawayo",
  pickupPoint: "Roadport, Harare",
  dropoffPoint: "City Hall, Bulawayo",
  departureTime: "Today, 14:30",
  cutoffTime: "Today, 13:45",
  vehicle: "Luxury coach",
  vehicleType: "bus",
  capacity: 52,
  bookedSeats: 38,
  price: 25,
  currency: "USD",
  operator: TRANSPORT_DEMO_OPERATOR.companyName,
  seatsAvailable: 14,
}

export const TRANSPORT_DEMO_PASSENGERS = [
  { name: "Makanaka Ncube", phone: "+263 77 210 4412", seat: "04A", payment: "Paid", checkIn: "Checked in" },
  { name: "Blessing Moyo", phone: "+263 71 928 1120", seat: "04B", payment: "Paid", checkIn: "Not boarded" },
  { name: "Rudo Chari", phone: "+263 78 551 3309", seat: "05A", payment: "Paid", checkIn: "Duplicate scan" },
  { name: "Farai Dube", phone: "+263 77 842 7711", seat: "06C", payment: "Pending", checkIn: "Hold" },
]

export const TRANSPORT_DEMO_PAYOUT = {
  gross: 950,
  platformFee: 47.5,
  netEarned: 902.5,
  paidOut: 400,
  available: 502.5,
  pendingPayouts: 0,
}

export const TRANSPORT_UPCOMING_DEPARTURES = [
  TRANSPORT_DEMO_ROUTE,
  {
    ...TRANSPORT_DEMO_ROUTE,
    origin: "Harare",
    destination: "Victoria Falls",
    dropoffPoint: "Victoria Falls Rank",
    departureTime: "Tomorrow, 07:00",
    cutoffTime: "Tomorrow, 06:15",
    bookedSeats: 29,
    seatsAvailable: 23,
    price: 45,
  },
  {
    ...TRANSPORT_DEMO_ROUTE,
    origin: "Bulawayo",
    destination: "Harare",
    pickupPoint: "City Hall, Bulawayo",
    dropoffPoint: "Roadport, Harare",
    departureTime: "Fri, 09:30",
    cutoffTime: "Fri, 08:45",
    bookedSeats: 41,
    seatsAvailable: 11,
    price: 25,
  },
]

export const TRANSPORT_POPULAR_ROUTES = [
  "Harare to Bulawayo",
  "Harare to Victoria Falls",
  "Bulawayo to Harare",
  "Harare to Mutare",
]
