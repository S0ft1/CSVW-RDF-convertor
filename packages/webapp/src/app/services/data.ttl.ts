export const dataTtl = `
@prefix ex: <https://example.org/vocabulary/> .
# @prefix foaf: <http://xmlns.com/foaf/0.1/> .
# @prefix rdf: <https://www.w3.org/1999/02/22-rdf-syntax-ns#> .
# @prefix rdfs: <https://www.w3.org/2000/01/rdf-schema#> .
# @prefix schema: <https://schema.org/> .
# @prefix xsd: <https://www.w3.org/2001/XMLSchema#> .
@prefix foaf: <https://example.org/vocabulary/> .
@prefix rdf: <https://example.org/vocabulary/> .
@prefix rdfs: <https://example.org/vocabulary/> .
@prefix schema: <https://example.org/vocabulary/> .
@prefix xsd: <https://example.org/vocabulary/> .

#region RDF schema
#region Hospital
# Hospital is represented by schema:MedicalOrganization

ex:employs rdfs:subPropertyOf schema:employee ;
    rdfs:label "Who is employed by the hospital."@en ;
    rdfs:domain schema:MedicalOrganization ;
    rdfs:range ex:Employee .
#endregion

#region HospitalBuilding
ex:HospitalBuilding a rdfs:Class ;
    rdfs:label "Building used by a hospital."@en ;
    rdfs:subClassOf schema:CivicStructure .

# inherits schema:address from schema:CivicStructure

ex:bedCapacity a rdf:Property ;
    rdfs:label "Number of beds for patients in the building."@en ;
    rdfs:domain ex:HospitalBuilding ;
    rdfs:range xsd:integer .

ex:partOf a rdf:Property ;
    rdfs:label "The hospital which the building is part of."@en ;
    rdfs:domain ex:HospitalBuilding ;
    rdfs:range schema:MedicalOrganization .
#endregion

#region Person
# Person is represented by schema:Person
#endregion

#region Employee
ex:Employee a rdfs:Class ;
    rdfs:label "Employee"@en ;
    rdfs:subClassOf schema:Person .

# inherits schema:telephone from schema:Person
#endregion

#region Doctor
ex:Doctor a rdfs:Class ;
    rdfs:label "Doctor"@en ;
    rdfs:subClassOf ex:Employee .

ex:takesCareOf a rdf:Property ;
    rdfs:label "The patient whom the doctor takes care of."@en ;
    rdfs:domain ex:Doctor ;
    rdfs:range ex:Patient .

ex:specializesIn a rdf:Property ;
    rdfs:label "Doctor's specialization."@en ;
    rdfs:domain ex:Doctor ;
    rdfs:range ex:Specialization .
#endregion

#region Specialization
ex:Specialization a rdfs:Class ;
    rdfs:label "Medical field"@en .

ex:payGrade a rdf:Property ;
    rdfs:label "Pay grade associated with the specialization."@en ;
    rdfs:domain ex:Specialization ;
    rdfs:range xsd:integer .
#endregion

#region Patient
ex:Patient a rdfs:Class ;
    rdfs:label "Patient"@en ;
    rdfs:subClassOf schema:Person .

ex:diagnosis a rdf:Property ;
    rdfs:label "Diagnosis of patient."@en ;
    rdfs:domain ex:Patient ;
    rdfs:range xsd:string .

ex:admitted a rdf:Property ;
    rdfs:label "Time and date when patient was admitted to the hospital."@en ;
    rdfs:domain ex:Patient ;
    rdfs:range xsd:dateTime .

ex:hospitalizedIn a rdf:Property ;
    rdfs:label "Building in which is patient hospitalized."@en ;
    rdfs:domain ex:Patient ;
    rdfs:range ex:Building .
#endregion
#endregion


#region Sample data
#region Specializations
ex:CVSurgery a ex:Specialization ;
    rdfs:label "cardio-vascular surgery"@en ;
    ex:payGrade 3 .

ex:Anesthesiology a ex:Specialization ;
    rdfs:label "anesthesiology"@en ;
    ex:payGrade 3 .

ex:Pediatrics a ex:Specialization ;
    rdfs:label "pediatrics"@en ;
    ex:payGrade 2 .

ex:Ophthalmology a ex:Specialization ;
    rdfs:label "ophthalmology"@en ;
    ex:payGrade 2 .

ex:Dermatology a ex:Specialization ;
    rdfs:label "dermatology"@en ;
    ex:payGrade 2 .

ex:Hematology a ex:Specialization ;
    rdfs:label "hematology"@en ;
    ex:payGrade 3 .
#endregion

#region Saint Thomas Hospital
@base <https://saintthomas.nhs.uk/> .
<> a schema:MedicalOrganization ;
    schema:legalName "Saint Thomas Hospital"@en ;
    schema:logo <assets/logo.png> ;
    schema:foundingDate "1962-12-08"^^xsd:date ;
    ex:employs <staff/834> ,
        <staff/261> ,
        <staff/512> .

<buildings/12> a ex:HospitalBuilding ;
    rdfs:label "Children"@en ;
    ex:partOf <> ;
    schema:address "High Street 1, CB1 9AS Teversham"@en ;
    ex:bedCapacity 120 .

<buildings/13> a ex:HospitalBuilding ;
    rdfs:label "Meyer Pavilion"@en ;
    ex:partOf <> ;
    schema:address "High Street 2, CB1 9AS Teversham"@en ;
    ex:bedCapacity 200 .

<buildings/14> a ex:HospitalBuilding ;
    rdfs:label "Highly contagious diseases"@en ;
    ex:partOf <> ;
    schema:address "High Street 3, CB1 9AS Teversham"@en ;
    ex:bedCapacity 400 .

<staff/834> a ex:Doctor ;
    schema:name "Mark Hamming"@en ;
    schema:birthDate "1988-07-27"^^xsd:date ;
    schema:telephone "01223-76-1873" ;
    schema:gender schema:Male ;
    ex:specializesIn ex:Pediatrics .

<staff/261> a ex:Doctor ;
    schema:name "Claudia Franke"@en ;
    schema:birthDate "1961-02-11"^^xsd:date ;
    schema:telephone "01223-87-2873" ;
    schema:gender schema:Female ;
    ex:specializesIn ex:Ophthalmology .

<staff/512> a ex:Doctor ;
    schema:name "Herbert Thompson"@en ;
    schema:birthDate "1961-04-24"^^xsd:date ;
    schema:telephone "01223-73-7399" ;
    schema:gender schema:Male ;
    ex:specializesIn ex:CVSurgery .

<patients/12345> a ex:Patient ;
    schema:name "Ellen Jones"@en ;
    schema:birthDate "2015-11-11"^^xsd:date ;
    schema:gender schema:Female ;
    ex:diagnosis "A candle lodged in pharynx (extinguished)."@en ;
    ex:admitted "2022-11-11T04:00:25"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/12> .

<patients/12346> a ex:Patient ;
    schema:name "Michael Pheeles"@en ;
    schema:birthDate "2012-03-20"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Three bite marks on left forearm, likely caused by pet hamster."@en ;
    ex:admitted "2022-11-11T10:33:01"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/12> .

<patients/12347> a ex:Patient ;
    schema:name "Samantha Kowalski"@en ;
    schema:birthDate "2000-07-04"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Myopia in both eyes (L 4d 40deg, R 4.2d), scheduled for laser surgery."@en ;
    ex:admitted "2022-11-11T14:01:30"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/13> .

<patients/12348> a ex:Patient ;
    schema:name "Martha Kowalski"@en ;
    schema:birthDate "2002-09-24"^^xsd:date ;
    schema:gender schema:Female ;
    ex:diagnosis "Chronic tinnitus in the right ear."@en ;
    ex:admitted "2022-06-28T08:00:11"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/13> .

<patients/12349> a ex:Patient ;
    schema:name "Steven Stone"@en ;
    schema:birthDate "2000-01-18"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Fractured femur and toes (injury from hiking)."@en ;
    ex:admitted "2022-11-14T11:01:10"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/13> .

<patients/12350> a ex:Patient ;
    schema:name "Frederick Jones"@en ;
    schema:birthDate "2014-09-09"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Second degree burn in face and neck area."@en ;
    ex:admitted "2022-10-24T12:08:05"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/12> .

<patients/12351> a ex:Patient ;
    schema:name "Zahra Watt"@en ;
    schema:birthDate "2016-03-07"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Lightheadedness – patient has a lightbulb instead of a head."@en ;
    ex:admitted "2021-01-01T00:00:00"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/12> .

<patients/12352> a ex:Patient ;
    schema:name "Chell"@en ;
    schema:birthDate "1985-04-06"^^xsd:date ;
    schema:gender schema:Female ;
    ex:diagnosis "Selective mute."@en ;
    ex:admitted "2007-10-10T16:29:56"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/13> .

<patients/12353> a ex:Patient ;
    schema:name "Jonathan John Jameson"@en ;
    schema:birthDate "1983-12-12"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Arachnophobia."@en ;
    ex:admitted "2000-05-04T12:30:15"^^xsd:dateTime .

<patients/12354> a ex:Patient ;
    schema:name "Wilbur Knight"@en ;
    schema:birthDate "1988-04-05"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Isekaitis."@en ;
    ex:admitted "2003-05-17T13:10:42"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/14> .

<patients/12355> a ex:Patient ;
    schema:name "Daanish Grant"@en ;
    schema:birthDate "1960-07-26"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Leprosy."@en ;
    ex:admitted "2003-05-17T15:00:49"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/14> .

<staff/834> ex:takesCareOf <patients/12345> ,
        <patients/12346> ,
        <patients/12351> .
<staff/261> ex:takesCareOf <patients/12347> ,
        <patients/12348> ,
        <patients/12349> ,
        <patients/12353> .
<staff/512> ex:takesCareOf <patients/12350> ,
        <patients/12352> ,
        <patients/12354> .
#endregion

#region Golden Fields Hospital
@base <https://goldenfields.nhs.uk/> .
<> a schema:MedicalOrganization ;
    schema:legalName "Golden Fields Hospital"@en ;
    schema:logo <assets/logo.png> ;
    schema:foundingDate "1999-01-26"^^xsd:date ;
    ex:employs <staff/356> ,
        <staff/342> .

<buildings/10> a ex:HospitalBuilding ;
    rdfs:label "Southern Pavilion"@en ;
    ex:partOf <> ;
    schema:address "Low Street 2, DE2 9AS Fordor"@en ;
    ex:bedCapacity 280 .

<staff/356> a ex:Doctor ;
    schema:name "Joana Veritova"@en ;
    schema:birthDate "1971-03-14"^^xsd:date ;
    schema:telephone "01223-76-2842" ;
    schema:gender schema:Female ;
    ex:specializesIn ex:Hematology ,
        ex:Pediatrics .

<staff/342> a ex:Doctor ;
    schema:name "Martin Sleplen"@en ;
    schema:birthDate "1974-07-06"^^xsd:date ;
    schema:telephone "01223-64-8737" ;
    schema:gender schema:Male ;
    ex:specializesIn ex:Anesthesiology ,
        ex:Ophthalmology .

<patients/22355> a ex:Patient ;
    schema:name "Kevin Dart"@en ;
    schema:birthDate "1960-03-27"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Awaiting examination, suspicion of whooping cough."@en ;
    ex:admitted "2021-09-11T09:17:01"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/10> .

<patients/22356> a ex:Patient ;
    schema:name "Wilfred Beahan"@en ;
    schema:birthDate "1963-05-15"^^xsd:date ;
    schema:gender schema:Male ;
    ex:diagnosis "Rare case of leg paralysis from long sitting, requires a specialist."@en ;
    ex:admitted "2021-11-09T19:22:14"^^xsd:dateTime ;
    ex:hospitalizedIn <buildings/10> .

<staff/356> ex:takesCareOf <patients/22355> .
<https://saintthomas.nhs.uk/staff/834> ex:takesCareOf <patients/22356> .
#endregion

#region BMI Lindsey Hospital
@base <https://bmilindsey.nhs.uk/> .
<> a schema:MedicalOrganization ;
    schema:legalName "BMI Lindsey Hospital"@en ;
    schema:logo <assets/logo.png> ;
    schema:foundingDate "1989-09-12"^^xsd:date .
#endregion
#endregion

`;
