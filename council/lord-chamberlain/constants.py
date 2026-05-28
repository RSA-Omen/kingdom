"""All GIDs and static mappings for The Lord Chamberlain."""

ASANA_BASE_URL           = "https://app.asana.com/api/1.0"
ASANA_WORKSPACE_GID      = "1149511082091035"
ASANA_MY_TASKS_GID       = "1211518294083562"
ASANA_DIGITAL_GID        = "1200457408099570"
ASANA_IT_SUPPORT_GID     = "1200470842604591"
ASANA_USER_GID           = "1211518293871240"

SECTION_INBOX            = "1200527647096291"
SECTION_CUSTOMER_SUPPORT = "1203308202412854"
SECTION_INTERNAL_SYSTEMS = "1211583322141287"
SECTION_OLGA             = "1210783271964117"
SECTION_CARBON_SCOUT_MK6 = "1208821439698421"
SECTION_ILR              = "1210746791091336"
SECTION_GAIA             = "1213197771245521"
SECTION_PARKING_LOT      = "1212234392758835"
SECTION_IT_NEW_REQUESTS  = "1200470842604593"

CF_PRIORITY              = "1200265450097721"
CF_TASK_STATUS           = "1200445220494893"

LC_TAG_NAME              = "lc-triaged"

SECTION_NAMES = {
    SECTION_INBOX:            "Inbox",
    SECTION_CUSTOMER_SUPPORT: "Customer Support",
    SECTION_INTERNAL_SYSTEMS: "Internal System Automations",
    SECTION_OLGA:             "OLGA Defects and Improvements",
    SECTION_CARBON_SCOUT_MK6: "Carbon Scout Mk6",
    SECTION_ILR:              "Inline Leach Reactors",
    SECTION_GAIA:             "Gaia Biodigester Improvements",
    SECTION_PARKING_LOT:      "Parking Lot",
    SECTION_IT_NEW_REQUESTS:  "New Requests",
}

PROJECT_NAMES = {
    ASANA_DIGITAL_GID:    "Digital",
    ASANA_IT_SUPPORT_GID: "IT Support Request",
}

STATUS_BY_CLASSIFICATION = {
    "bug":           "In Progress",
    "feature":       "In Progress",
    "support":       "Waiting-Internal",
    "it-request":    "Waiting-External",
    "internal-tool": "In Progress",
    "rd-idea":       "Review",
    "unclear":       "Review",
}

# Keyword routing for bug/feature — first match wins, case-insensitive substring
KEYWORD_ROUTING = [
    (["olga", "draw", "drawings", "works order", "transmittal"], SECTION_OLGA),
    (["carbon scout", "gold room"], SECTION_CARBON_SCOUT_MK6),
    (["ilr", "inline leach", "reactor"], SECTION_ILR),
    (["gaia", "biodigester", "compost"], SECTION_GAIA),
    (
        ["gekko tracks", "timesheet", "leave", "reception", "voice mail",
         "pronto", "erp", "inventory"],
        SECTION_INTERNAL_SYSTEMS,
    ),
    # Looser carbon/CS signals placed after the compound "carbon scout" guard above
    (["carbon", "cs"], SECTION_CARBON_SCOUT_MK6),
]
