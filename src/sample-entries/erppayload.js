{
  "redirecturl"= "https://avalift.benymbl.co/NymblSuiteIntegration",
  "Data"= {
  "UniqueId": "17012024",
  "TransactionType": "Invoice",
  "TransactionCode": "INV",
  "LocationCode": "",
  "ReferenceId": "",
  "CurrencyCode": "AED",
  "Note": "",
  "Number": "325",  //invoice number
  "Date": "15-12-2025",
  "ItemTotal": 495.0, // total amount
  "Discount": 0.0,
  "DiscountPercentage": 0.0,
  "TaxesIncluded": "Y", // yes or no
  "TAX": [
  ],
  "SubTotal": 471.43, // total amount
  "TotalTax": 23.57, // vat amount if there
  "TotalAmount": 495.0, // total with vat
  "Items": [
    {
      "UniqueId": "8765", // ride id
      "ProductTitle": "Basumati rice", // ride type
      "SKU": "", //
      "Quantity": 1.0,
      "Price": 50.0, // base fare may be
      "SubTotal": 471.43, // total amount
      "TaxableAmount" : 471.43, // vat amount
      "TotalTax": 23.57, // total vat
      "TaxesIncluded": "Y",
      "TAX": [
        {
          "UniqueId": "25643",
          "TaxCode": "VAT05",
          "Percentage": 5.0, //vat %
          "Value": 23.57, // amount
          "SKU": "I0000178QA7" //
        }
      ],
      "Discount": 5.0, // coupon discount
      "DiscountPercentage": 0.0,
      "TotalAmount": 495.0
    }
  ],
  "Customer": {
    "UniqueId": "125", // cust id
    "Name": "Cash Customer", // name 
    "Phone": "22354369", // num
    "Email": "ny45464@hjjk.com",// mail id
    "Address": {
      "Address1": "",
      "Address2": "",
      "City": "",
      "Country": "",
      "Area": ""
    },
    "UseSameDeliveryAddress": "Y",
    "DeliveryAddress": {
      "Address1": "",
      "Address2": "",
      "City": "",
      "Country": "",
      "Area": ""
    }
  },
  "Salesman": {
    "UniqueId": "8754", // driver id
    "Name": "Default Salesman" // driver name
  },
  "Payment": [
    {
      "UniqueId": "6358", // payment id
      "Type": "CASH", // payment type
      "Amount": 495.0, // amount
      "Tender": 0.0,
      "Change": 0.0,
      "Reference": ""
    }
  ],
  "MoreInfo": [
    {
      "Key": "",
      "Value": ""
    }
  ]
}
}