# CMMS — Computerized Maintenance Management System
## Product Brainstorm, Functional Scope, Workflow, Data Foundation, Reliability, and MVP Roadmap

---

## 1. Executive Summary

CMMS sebaiknya tidak diposisikan hanya sebagai aplikasi untuk mencatat pekerjaan maintenance.

Visi yang lebih kuat adalah:

> **CMMS = Maintenance Operating System**

CMMS menjadi pusat untuk memastikan seluruh aktivitas maintenance:

- tercatat,
- terencana,
- terstandarisasi,
- terkontrol,
- dapat ditelusuri,
- dapat dianalisis,
- dan dapat terus ditingkatkan.

Tujuan utamanya bukan sekadar menjawab:

> “Maintenance apa yang harus dikerjakan?”

tetapi juga:

- Apa yang rusak?
- Kenapa rusak?
- Seberapa sering rusak?
- Siapa yang mengerjakan?
- Berapa lama pengerjaannya?
- Part apa yang digunakan?
- Tool apa yang digunakan?
- Berapa biaya maintenance-nya?
- Apakah masalah yang sama berulang?
- Apakah preventive maintenance efektif?
- Asset mana yang menjadi bad actor?
- Apakah asset tersebut masih layak dipertahankan?

Core CMMS secara sederhana:

```text
ASSET
  ↓
MAINTENANCE REQUEST
  ↓
WORK ORDER
  ↓
JOB EXECUTION
  ↓
PART / TOOL / LABOR
  ↓
FAILURE RECORD
  ↓
HISTORY
  ↓
MAINTENANCE ANALYTICS
```

Pusat sistem bukan dashboard.

Pusat sistem adalah:

> **Asset + Work Order + Maintenance History**

---

# 2. Product Principle

CMMS yang kuat harus dibangun dengan beberapa prinsip utama.

## 2.1 Traceability

Setiap aktivitas maintenance harus dapat ditelusuri.

```text
Every Asset
Every Failure
Every Action
Every Part
Every Tool
Every Technician
Every Cost
Every Minute
Traceable
```

---

## 2.2 Structured Data over Free Text

Free text tetap tersedia, tetapi data inti harus menggunakan master data.

Contoh:

Jangan hanya:

```text
Bearing rusak
```

Gunakan:

```text
Problem
Abnormal Vibration

Failure Mode
Bearing Wear

Cause
Insufficient Lubrication

Action
Bearing Replacement
```

---

## 2.3 Asset Centric

Semua informasi maintenance harus kembali ke asset.

```text
Asset
 ├── Work Order
 ├── Maintenance History
 ├── Failure
 ├── Part
 ├── Tool
 ├── Cost
 ├── Document
 ├── Inspection
 ├── Calibration
 └── Measurement
```

---

## 2.4 Standardized Maintenance

Aktivitas rutin tidak boleh selalu dibuat dari nol.

Gunakan:

```text
Job Plan
   ↓
PM Schedule
   ↓
Work Order
```

---

## 2.5 Maintenance History as Knowledge

CMMS bukan hanya penyimpanan data.

Maintenance history harus menjadi knowledge base untuk:

- troubleshooting,
- failure analysis,
- spare part planning,
- PM optimization,
- replacement decision,
- reliability improvement.

---

# 3. Core Domain CMMS

CMMS dibagi menjadi enam domain utama.

```text
01 ASSET
02 WORK MANAGEMENT
03 MAINTENANCE
04 RESOURCE
05 RELIABILITY
06 CONTROL
```

---

# 4. Asset Management

Asset adalah objek utama CMMS.

## 4.1 Asset Hierarchy

Hierarchy yang disarankan:

```text
Company
└── Site
    └── Plant
        └── Area
            └── Line
                └── Machine
                    └── Component
```

Contoh:

```text
Factory Bandung
└── Production
    └── Finishing
        └── Polishing Area
            ├── Poles-01
            │   ├── Motor
            │   ├── Spindle
            │   ├── Bearing
            │   └── Inverter
            │
            ├── Poles-02
            └── Poles-03
```

Tidak semua asset harus dipaksa sampai component level.

Gunakan prinsip:

```text
Apakah component membutuhkan histori sendiri?
        ↓
Ya
        ↓
Jadikan component sebagai maintainable asset
```

Contoh:

| Component | Separate Asset? |
|---|---|
| Servo Motor Mahal | Ya |
| Spindle | Ya |
| PLC Module Critical | Ya |
| Sensor Critical | Mungkin |
| Bearing Standard | Biasanya Spare Part |
| Baut | Tidak |

---

# 5. Asset Master

Setiap asset memiliki **Asset Passport**.

## 5.1 Basic Asset Information

| Field | Example |
|---|---|
| Asset ID | POL-03 |
| Asset Name | Mesin Poles 03 |
| Asset Type | Polishing Machine |
| Category | Production |
| Location | Finishing Area |
| Manufacturer | XYZ |
| Model | P-750 |
| Serial Number | SN92822 |
| Installation Date | 12 Jun 2024 |
| Warranty Until | 12 Jun 2027 |
| Criticality | High |
| Cost Center | Finishing |
| Status | Active |
| Responsible Team | Maintenance Mechanical |

---

## 5.2 Asset Documents

Asset dapat memiliki dokumen:

- Manual
- Drawing
- Electrical Diagram
- Pneumatic Diagram
- Datasheet
- SOP
- PLC Backup
- Machine Photo
- Vendor Contact
- Warranty Document
- Calibration Certificate
- Inspection Sheet

---

# 6. Asset Criticality

Tidak semua asset memiliki tingkat kepentingan yang sama.

Contoh classification:

```text
A - Critical
B - High
C - Medium
D - Low
```

Atau score-based:

| Parameter | Score |
|---|---:|
| Production Impact | 5 |
| Safety Impact | 5 |
| Quality Impact | 4 |
| Replacement Cost | 3 |
| Redundancy | 1 |

```text
Criticality Score = 18
```

Criticality dapat digunakan untuk menentukan:

- WO Priority
- PM Frequency
- SLA
- Approval
- Escalation
- Spare Part Policy
- Inspection Frequency

---

# 7. Maintenance Request

Maintenance Request berbeda dengan Work Order.

Maintenance Request adalah:

> laporan bahwa ada sesuatu yang perlu diperiksa atau diperbaiki.

Contoh:

```text
MR-000283

Asset
Poles-03

Reported By
Operator Budi

Issue
Suara spindle lebih kasar dari biasanya

Severity
Medium

Attachment
Photo
Video
```

Maintenance Request dapat:

```text
Reject
Duplicate
Monitor
Convert to WO
```

Pemisahan Request dan Work Order mencegah Work Order penuh dengan laporan yang belum tervalidasi.

---

# 8. Work Order

Work Order adalah jantung CMMS.

Contoh struktur:

```text
WORK ORDER
WO-2026-002819

Asset
Poles-03

Type
Corrective

Priority
P2 High

Status
In Progress

Assigned Team
Mechanical

Assigned Technician
Budi

Requested
22 Sep 2026 08:12

Target
22 Sep 2026 12:00
```

Work Order dapat memiliki:

```text
Problem
Tasks
Checklist
Labor
Parts
Tools
Measurement
Safety
Documents
Failure
Cost
Timeline
Approval
Attachment
```

---

# 9. Work Order Type

Minimal:

```text
Corrective
Preventive
Inspection
Emergency
Improvement
Calibration
```

Versi lebih matang:

```text
Corrective Planned
Corrective Unplanned
Preventive
Predictive
Condition Based
Inspection
Calibration
Breakdown
Project
Modification
```

Untuk MVP, sebaiknya sederhana terlebih dahulu.

---

# 10. Work Order Status

Status jangan terlalu banyak.

Flow yang disarankan:

```text
DRAFT
   ↓
OPEN
   ↓
ASSIGNED
   ↓
IN PROGRESS
   ↓
WAITING
   ↓
COMPLETED
   ↓
VERIFIED
   ↓
CLOSED
```

Waiting Reason:

```text
Waiting Spare Part
Waiting Vendor
Waiting Production
Waiting Approval
Waiting Tool
Waiting Material
Waiting External Service
```

Waiting Reason penting untuk menganalisis kenapa maintenance membutuhkan waktu lama.

---

# 11. Work Order Priority

## P1 — Emergency

- Safety impact
- Production stopped
- Major equipment failure
- Critical machine breakdown

## P2 — High

- Production affected
- Potential breakdown
- High asset criticality

## P3 — Normal

- Repair required
- Tidak berdampak besar ke production

## P4 — Low

- Cosmetic
- Minor improvement
- Non-critical repair

Priority dapat ditentukan dari:

```text
Asset Criticality
+
Issue Severity
+
Operational Impact
```

---

# 12. Job Plan

Job Plan adalah template maintenance.

Contoh:

```text
JP-POL-001

Motor Inspection
```

Isi:

```text
Duration
30 minutes

Skill
Mechanical L2

Required Personnel
1

Tools
Multimeter
Thermal Gun

Safety
LOTO

Tasks
1. Inspect housing
2. Measure temperature
3. Check vibration
4. Check bearing noise
5. Check coupling
```

Job Plan bisa memiliki:

- Estimated Duration
- Technician Skill
- Required Personnel
- Checklist
- Spare Part
- Tools
- Safety Requirement
- SOP
- Attachment
- Measurement
- Acceptance Criteria

---

# 13. Preventive Maintenance

PM harus mendukung beberapa trigger.

## 13.1 Calendar Based

```text
Every:
7 days
30 days
3 months
6 months
1 year
```

---

## 13.2 Meter Based

```text
Every:
500 operating hours
10,000 cycles
50,000 shots
```

---

## 13.3 Combined Trigger

```text
Every 30 days

OR

500 operating hours

Whichever comes first
```

PM terdiri dari:

```text
Asset
+
Job Plan
+
Schedule
        ↓
Work Order
```

---

# 14. Maintenance Calendar

Planner membutuhkan view:

```text
Day
Week
Month
```

Calendar menampilkan:

- PM Due
- PM Overdue
- Planned Corrective
- Inspection
- Calibration
- Vendor Maintenance

Contoh:

```text
MON 22
Poles-01 PM

TUE 23
Compressor Inspection

WED 24
Poles-03 Bearing Replacement

THU 25
Oven Calibration

FRI 26
Electrical Panel Inspection
```

Idealnya mendukung:

- Drag & drop
- Reschedule
- Assign technician
- Filter by area
- Filter by maintenance type
- Filter by technician

---

# 15. Maintenance Checklist

Checklist jangan hanya checkbox.

Supported Field Type:

```text
Boolean
Number
Text
Photo
Pass / Fail
Multiple Choice
Measurement
Signature
```

Contoh:

```text
Bearing Temperature

Value:
68 °C

Acceptable:
< 75 °C

Result:
PASS
```

---

# 16. Inspection

Inspection berbeda dengan PM.

Tujuan inspection adalah:

```text
Observe
Measure
Evaluate
```

Contoh:

```text
Weekly Motor Inspection

Temperature
70 °C

Vibration
5.4 mm/s

Noise
Normal

Result
WARNING
```

Jika gagal:

```text
Generate Maintenance Request
```

Inspection dapat memiliki:

- measurement,
- threshold,
- pass/fail,
- photo,
- observation,
- automatic request generation.

---

# 17. Calibration

Calibration digunakan untuk measuring equipment dan tools.

Contoh asset:

```text
Pressure Gauge
Thermometer
Torque Wrench
Scale
Sensor
```

Data:

- Calibration Schedule
- Calibration Vendor
- Certificate
- Result
- Next Calibration
- Expiry
- Calibration Status

Jika calibration expired:

```text
CALIBRATION EXPIRED
```

Tool dapat diblokir agar tidak digunakan pada WO tertentu.

---

# 18. Failure Management

Failure Management menjadi bagian penting dari CMMS.

Saat corrective WO selesai:

```text
Problem
Failure Mode
Cause
Action
```

Contoh:

```text
Problem
Motor vibration

Failure Mode
Bearing wear

Cause
Insufficient lubrication

Action
Bearing replaced
```

Versi lebih matang:

```text
Problem
Failure Mode
Mechanism
Cause
Root Cause
Remedy
```

Contoh:

```text
Problem
Machine overheating

Failure Mode
Motor overheating

Mechanism
Excessive friction

Cause
Bearing damage

Root Cause
Lubrication interval insufficient

Remedy
Replace bearing
```

---

# 19. Failure Library

Gunakan master data.

## Problem

```text
High Temperature
Abnormal Noise
Vibration
Leak
No Power
Slow Movement
Low Pressure
```

## Failure Mode

```text
Bearing Wear
Motor Failure
Sensor Failure
Loose Connection
Seal Damage
Misalignment
```

## Cause

```text
Wear
Contamination
Overload
Poor Lubrication
Installation Error
Electrical Fault
```

## Remedy

```text
Replace
Repair
Clean
Align
Lubricate
Calibrate
Adjust
```

Free text tetap disediakan sebagai note.

---

# 20. Spare Parts Management

Core spare part module:

```text
Part Master
Stock
Transaction
Asset BOM
Reservation
Consumption
```

Contoh:

```text
Bearing 6204

Part No
BRG-6204

Stock
8

Min
4

Max
15

Location
Warehouse A-Rack 03

Unit Cost
Rp 125.000
```

---

# 21. Asset BOM

Setiap asset dapat memiliki Bill of Material.

```text
Poles-03

Motor
├── Bearing 6204 ×2
├── Seal ABC ×1
└── Coupling XYZ ×1
```

Saat Work Order dibuat:

```text
WO requires
Bearing 6204 ×2
```

Part status:

```text
Reserved
Issued
Returned
Consumed
```

---

# 22. Spare Part Stock Control

Fitur:

- Current Stock
- Minimum Stock
- Maximum Stock
- Reorder Level
- Reorder Quantity
- Warehouse
- Bin Location
- Lot
- Serial Number
- Supplier
- Unit Cost
- Lead Time

Contoh:

```text
Stock 2

Minimum Stock 2

→ Reorder Alert
```

---

# 23. Tool Management

Tool Master:

```text
Tool
Location
Availability
Calibration Expiry
Condition
```

Contoh:

```text
Torque Wrench 01

Status
Available

Calibration
Valid

Next Calibration
12 Dec 2026
```

WO dapat memiliki required tool:

```text
1 × Torque Wrench
1 × Bearing Puller
```

---

# 24. Technician Management

Data technician:

- Name
- Department
- Team
- Shift
- Skill
- Certification
- Authorization
- Hourly Cost
- Availability

---

# 25. Skill Matrix

Contoh:

```text
Budi

Mechanical     L3
Electrical     L1
PLC            L1
Welding        L2
```

Job Plan:

```text
Bearing Replacement

Required:
Mechanical L2+
```

Sistem dapat membantu assignment technician berdasarkan skill.

---

# 26. Maintenance Labor

Setiap WO mencatat labor.

```text
Technician
Start
Stop
Duration
```

Contoh:

```text
Budi
09:12 → 10:02
50 min

Andi
09:20 → 10:02
42 min
```

Total:

```text
Labor
1.53 man-hours
```

Data ini digunakan untuk:

- Workload
- Technician Utilization
- Maintenance Cost
- Backlog
- Capacity Planning

---

# 27. Safety Management

Setiap Job Plan atau WO dapat memiliki safety requirement.

Contoh:

```text
LOTO Required

PPE
☐ Helmet
☐ Gloves
☐ Safety Glass
☐ Electrical Gloves

Hazard
Electrical
Rotating Equipment
Hot Surface
```

Sebelum:

```text
Start Work
```

Technician melakukan:

```text
Safety Confirmation
```

---

# 28. Maintenance Document Management

Dokumen yang dapat dikaitkan ke asset maupun WO:

- Manual
- Drawing
- Datasheet
- SOP
- Inspection Sheet
- Electrical Diagram
- Pneumatic Diagram
- PLC Backup
- Vendor Report
- Service Report
- Photo
- Video
- Certificate

---

# 29. Maintenance History

Asset history harus mudah dilihat.

Contoh:

```text
Poles-03

20 Sep
Inspection

18 Sep
Corrective
Bearing noise

11 Sep
PM

03 Sep
Corrective
Sensor issue

28 Aug
PM
```

Filter:

```text
Work Order
Failure
Part Change
Measurement
Cost
Document
Inspection
Calibration
```

---

# 30. Cost Tracking

Setiap Work Order mempunyai cost.

```text
Labor Cost
+
Spare Part Cost
+
Vendor Cost
+
Misc Cost
```

Contoh:

```text
Labor          Rp   250.000
Bearing        Rp   500.000
Vendor         Rp         0
Other          Rp    50.000
---------------------------
Total          Rp   800.000
```

Asset cost dapat dianalisis per:

- Month
- Year
- Asset
- Area
- Work Order Type
- Failure
- Spare Part
- Vendor

---

# 31. Vendor Management

Vendor data:

```text
Vendor
Service Type
PIC
Contract
SLA
Rate
Performance
```

WO execution type:

```text
Internal
External Vendor
Mixed
```

Contoh:

```text
Compressor Overhaul

Vendor:
ABC Compressor Service

Target:
2 days

Actual:
3 days
```

---

# 32. Warranty Tracking

Asset atau component dapat memiliki warranty.

Jika masih aktif:

```text
Warranty Active
```

Saat WO dibuat:

```text
This component is still covered by warranty.
```

Data warranty:

- Vendor
- Start Date
- End Date
- Terms
- Attachment
- Claim History

---

# 33. Meter Reading

Asset dapat memiliki meter:

```text
Runtime
Cycle
Distance
Energy
```

Contoh:

```text
Poles-03

Runtime
8,442 h

Cycle
423,821 cycles
```

Meter dapat digunakan sebagai trigger PM.

---

# 34. Backlog Management

Backlog harus menunjukkan workload sebenarnya.

Setiap backlog memiliki:

```text
Age
Priority
Asset Criticality
Estimated Hours
Waiting Reason
```

Contoh:

| WO | Asset | Age | Priority | Est |
|---|---|---:|---|---:|
| WO201 | Oven 2 | 2 days | High | 4h |
| WO202 | Poles 3 | 6 days | Medium | 2h |
| WO203 | Compressor | 21 days | High | 8h |

Capacity:

```text
Backlog
145 man-hours

Available Capacity
60 h/week

Backlog
2.4 weeks
```

Ini lebih meaningful dibanding hanya:

```text
56 Open Tickets
```

---

# 35. Repeat Failure Detection

Repeat Failure sebaiknya tersedia bahkan sebelum AI.

Rule sederhana:

```text
Same Asset
+
Same Failure Mode
+
Within 30 Days
```

Hasil:

```text
REPEAT FAILURE
```

Contoh:

```text
Poles-03
Bearing Wear

17 Aug
02 Sep
20 Sep
```

Sistem memberikan warning:

```text
Repeat Failure Detected
```

---

# 36. Root Cause Analysis

RCA digunakan untuk:

- critical failure,
- repeat failure,
- high-cost failure,
- safety failure,
- chronic issue.

Metode:

```text
5 Why
Fishbone
Corrective Action
Preventive Action
```

Contoh:

```text
Problem
Bearing repeatedly failed

Why?
Insufficient lubrication

Why?
Lubrication interval too long

Why?
PM based on calendar

Why?
Machine utilization increased

Root Cause
PM interval no longer suitable
```

CAPA:

```text
Change PM

30 days
→
400 runtime hours
```

---

# 37. Approval Flow

Tidak semua WO perlu approval.

Contoh rule:

```text
P1 Emergency
→ Auto Allow

P2
→ Supervisor Approval

Cost > Rp10 juta
→ Manager Approval
```

Closure critical asset:

```text
Technician Complete
        ↓
Supervisor Verify
        ↓
Closed
```

---

# 38. Notification

Notification event:

```text
PM Due Tomorrow

PM Overdue

Critical WO Created

WO SLA Exceeded

Spare Part Below Minimum

Calibration Expiring

Warranty Expiring

Repeat Failure Detected

Approval Required
```

Channel dapat berupa:

- In-App
- Email
- WhatsApp
- Push Notification

---

# 39. Role and Permission

Role yang disarankan:

```text
Maintenance Manager
Planner
Supervisor
Technician
Warehouse
Requester
Administrator
Viewer
```

## Requester

```text
Create Request
View Request Status
```

## Technician

```text
View Assigned WO
Execute Task
Record Measurement
Use Spare Part
Upload Photo
Complete WO
```

## Planner

```text
Create Schedule
Assign Technician
Manage Backlog
Manage Job Plan
Manage PM
```

## Supervisor

```text
Approve WO
Verify Completion
Monitor Team
Review Failure
```

## Warehouse

```text
Issue Part
Return Part
Stock Adjustment
Manage Bin
```

---

# 40. CMMS Navigation

Recommended navigation:

```text
Dashboard

Assets

Work
 ├── Requests
 ├── Work Orders
 ├── Calendar
 └── Backlog

Preventive
 ├── PM Schedule
 ├── Job Plans
 └── Inspections

Inventory
 ├── Spare Parts
 ├── Stock
 └── Tools

Reliability
 ├── Failure
 ├── RCA
 └── History

People
 ├── Technicians
 └── Skills

Reports

Master Data
```

---

# 41. Technician Mobile UX

CMMS sebaiknya mobile-first untuk technician.

Homepage:

```text
09:41

Hi Budi

━━━━━━━━━━━━━━━━━━━━

1 Critical Work

Poles-03
High Vibration

Priority
P1

[ START WORK ]

━━━━━━━━━━━━━━━━━━━━

TODAY

3 Work Orders
2 PM
1 Inspection
```

Fitur mobile:

- Scan QR Asset
- View Asset Passport
- View Assigned WO
- Start / Pause / Complete Work
- Checklist
- Measurement
- Spare Part Usage
- Tool Usage
- Photo Upload
- Failure Coding
- Digital Signature

---

# 42. Asset QR Code

Setiap asset memiliki QR.

Scan:

```text
SCAN QR
```

Hasil:

```text
Machine Passport
+
Open Work Order
+
Maintenance History
+
Document
+
Spare Part BOM
```

---

# 43. Maintenance Dashboard

Dashboard Maintenance Manager:

```text
WORK ORDERS

Open              24
In Progress        11
Waiting             5
Overdue             7

PM COMPLIANCE
92%

CORRECTIVE
18 this month

BREAKDOWN
6 this month

BACKLOG
2.4 weeks
```

---

# 44. Core KPI CMMS

## Operational KPI

```text
PM Compliance
Schedule Compliance
WO Completion Rate
Overdue WO
Maintenance Backlog
Emergency Work %
Planned Maintenance %
Corrective Maintenance %
```

## Reliability KPI

```text
MTBF
MTTR
Repeat Failure
Failure Frequency
Bad Actor Asset
```

## Cost KPI

```text
Maintenance Cost
Cost per Asset
Cost per Work Order
Spare Part Consumption
Vendor Cost
Labor Cost
```

## Resource KPI

```text
Technician Workload
Technician Utilization
Backlog Weeks
Available Maintenance Capacity
```

---

# 45. Maintenance Effectiveness

Dashboard management tidak boleh berhenti pada:

```text
WO Open
WO Closed
WO Overdue
```

Harus bisa menjawab:

- Apakah maintenance terencana?
- Asset apa yang paling sering rusak?
- Asset mana yang menghabiskan biaya terbesar?
- Berapa repeat failure?
- Apakah PM efektif?
- Apa penyebab backlog?
- Spare part apa yang paling banyak dikonsumsi?

---

# 46. Recommended Master Data

Master data CMMS:

| Domain | Master Data |
|---|---|
| Organization | Company, Site, Plant, Area |
| Asset | Asset, Asset Type, Asset Category |
| Location | Building, Line, Cell |
| Criticality | Criticality Level |
| Maintenance | Maintenance Type |
| Work | Job Plan, Checklist |
| Priority | P1, P2, P3, P4 |
| Status | WO Status |
| Failure | Problem, Failure Mode, Cause, Remedy |
| Technician | Technician, Skill, Certification |
| Inventory | Spare Part, Warehouse, Bin |
| Tool | Tool, Tool Type |
| Vendor | Vendor, Service Type |
| Safety | Hazard, PPE, LOTO |
| Cost | Cost Center |
| Document | Document Type |
| Measurement | Measurement Type, Unit |
| Calendar | Shift, Working Calendar |

---

# 47. Suggested Data Relationship

```text
ASSET
 ├── Maintenance Request
 ├── Work Order
 │    ├── Task
 │    ├── Checklist
 │    ├── Labor
 │    ├── Part Usage
 │    ├── Tool Usage
 │    ├── Measurement
 │    ├── Failure
 │    ├── Cost
 │    └── Attachment
 │
 ├── PM Schedule
 ├── Inspection
 ├── Calibration
 ├── Meter
 ├── Document
 ├── BOM
 └── Maintenance History
```

---

# 48. CMMS Core Workflow

## Corrective Maintenance

```text
Issue Detected
      ↓
Maintenance Request
      ↓
Triage
      ↓
Work Order
      ↓
Assign Technician
      ↓
Execute Work
      ↓
Record Labor
      ↓
Record Part
      ↓
Failure Coding
      ↓
Complete
      ↓
Verify
      ↓
Close
      ↓
Maintenance History
```

---

## Preventive Maintenance

```text
Asset
 +
Job Plan
 +
Schedule
      ↓
PM Due
      ↓
Generate Work Order
      ↓
Assign Technician
      ↓
Execute Checklist
      ↓
Measurement
      ↓
Complete
      ↓
Verify
      ↓
History
```

---

## Inspection Workflow

```text
Inspection Schedule
      ↓
Inspection WO
      ↓
Measure / Observe
      ↓
PASS
or
FAIL
      ↓
If FAIL
Generate Maintenance Request
```

---

# 49. Product Scope Boundary

CMMS harus tetap menjadi CMMS.

Jangan terlalu cepat berubah menjadi:

- ERP
- MES
- SCADA
- Procurement System
- Accounting System
- Warehouse ERP
- IoT Platform

CMMS boleh memiliki interface ke sistem tersebut, tetapi core ownership tetap:

```text
Asset
Maintenance
Work Order
Failure
Resource
History
Reliability
```

---

# 50. MVP Roadmap

## MVP 1 — CMMS Core

Focus:

```text
Asset Master
Asset Hierarchy
Maintenance Request
Work Order
Job Plan
Preventive Maintenance
Checklist
Technician
Basic Spare Parts
Maintenance History
Dashboard
```

Goal:

> Menggantikan spreadsheet dan pencatatan manual.

---

## MVP 2 — Maintenance Control

Tambahkan:

```text
Inventory
Tools
Skill Matrix
Calendar
Backlog
Approval
Cost
Failure Coding
Vendor
Warranty
```

Goal:

> Maintenance mulai terkontrol secara operational.

---

## MVP 3 — Reliability

Tambahkan:

```text
MTBF
MTTR
Repeat Failure
RCA
Inspection
Calibration
Maintenance Analytics
Bad Actor Analysis
```

Goal:

> CMMS berubah dari work management system menjadi reliability platform.

---

# 51. Recommended Implementation Priority

Urutan implementasi:

```text
1. Master Data
2. Asset
3. Maintenance Request
4. Work Order
5. Job Plan
6. Preventive Maintenance
7. Technician
8. Spare Part
9. Failure Coding
10. Maintenance History
11. Backlog
12. Cost
13. RCA
14. Reliability Analytics
```

Jangan mulai dari dashboard.

Dashboard hanya akan bagus kalau foundational data sudah benar.

---

# 52. Core Product Philosophy

CMMS yang baik bukan aplikasi untuk menjawab:

> “Berapa banyak WO hari ini?”

CMMS yang baik harus berkembang sampai bisa menjawab:

> “Asset mana yang paling bermasalah?”

> “Failure apa yang paling sering terjadi?”

> “Kenapa failure tersebut terjadi?”

> “Berapa biaya maintenance untuk asset tersebut?”

> “Apakah masalah yang sama terus berulang?”

> “Apakah PM kita efektif?”

> “Apakah maintenance team overload?”

> “Apakah kita memperbaiki akar masalah atau hanya symptom?”

---

# 53. Final Product Positioning

Posisi produk yang paling kuat:

> **CMMS as a Maintenance & Reliability Operating System**

Core value:

```text
Plan
Execute
Control
Trace
Analyze
Improve
```

Dengan fondasi:

```text
Master Data
   ↓
Asset
   ↓
Job Plan
   ↓
Work Order
   ↓
Failure
   ↓
History
   ↓
Reliability
```

Visi akhirnya:

> CMMS tidak hanya mencatat bahwa maintenance sudah dilakukan.

CMMS harus membantu organisasi memahami:

```text
WHAT FAILED
WHY IT FAILED
HOW IT WAS FIXED
WHAT IT COST
HOW OFTEN IT HAPPENED
AND HOW TO PREVENT IT FROM HAPPENING AGAIN
```

---

# 54. Summary Module Map

```text
CMMS
│
├── Dashboard
│
├── Asset Management
│   ├── Asset Registry
│   ├── Asset Hierarchy
│   ├── Asset Passport
│   ├── Criticality
│   ├── BOM
│   └── Document
│
├── Work Management
│   ├── Maintenance Request
│   ├── Work Order
│   ├── Calendar
│   ├── Backlog
│   └── Approval
│
├── Maintenance Planning
│   ├── Job Plan
│   ├── Preventive Maintenance
│   ├── Inspection
│   └── Calibration
│
├── Resource Management
│   ├── Technician
│   ├── Skill Matrix
│   ├── Spare Parts
│   ├── Tools
│   ├── Vendor
│   └── Warranty
│
├── Reliability
│   ├── Failure Coding
│   ├── Repeat Failure
│   ├── RCA
│   ├── MTBF
│   ├── MTTR
│   └── Maintenance History
│
└── Control
    ├── Cost
    ├── KPI
    ├── Report
    ├── Notification
    ├── Role & Permission
    └── Master Data
```

---

# 55. Closing Statement

Prioritas utama pembangunan CMMS adalah memastikan:

> **Master Data → Asset → Job Plan → Work Order → Failure → History**

enam fondasi tersebut solid terlebih dahulu.

Setelah fondasi kuat, baru sistem berkembang ke:

```text
Control
Reliability
Cost
Analytics
Optimization
```

Dengan pendekatan ini, CMMS tidak berhenti menjadi digital maintenance checklist, tetapi berkembang menjadi platform maintenance yang benar-benar mendukung operational excellence dan reliability improvement.
