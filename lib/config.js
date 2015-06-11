module.exports = {
    port: process.env.PORT || 8080
  , host: process.env.BASE_URI || 'http://localhost'
  , fetchInterval: 10 // minutes
  , allPathKeys: [
        "Id"
      , "Speed"
      , "TravelTime"
      , "Status"
      , "DataAsOf"
      , "linkId"
      , "linkPoints"
      , "EncodedPolyLine"
      , "EncodedPolyLineLvls"
      , "Owner"
      , "Transcom_id"
      , "Borough"
      , "linkName"
    ]
  , staticPathKeys: [
        "Id"
      , "Status"
      , "DataAsOf"
      , "linkId"
      , "linkPoints"
      , "EncodedPolyLine"
      , "EncodedPolyLineLvls"
      , "Owner"
      , "Transcom_id"
      , "Borough"
      , "linkName"
    ]
};