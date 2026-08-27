export interface ReviewedEnrollmentPlacement {
  weekdayIso: number; classStartsLocal: string | null; classEndsLocal: string | null;
  plannedEntryLocalTime: string | null; plannedDurationMinutes: number | null;
}
export interface ReviewedEnrollmentPlanItem {
  subscriptionId: string; pathCode: string; expectedWeeklyCommitment: number; placements: ReviewedEnrollmentPlacement[];
}
export interface ReviewedEnrollmentUnresolved {
  subscriptionId: string; pathCode: string; expectedWeeklyCommitment: number; reason: "DOUBLE_SESSION_ASSIGNMENT_MODEL_GAP";
}

export const REVIEWED_ENROLLMENT_PLAN: ReviewedEnrollmentPlanItem[] = [
  {
    "subscriptionId": "01a03b5d-d400-7f0b-a1e5-1fc819f96b98",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "19:30",
        "classEndsLocal": "21:00",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "19:30",
        "classEndsLocal": "21:00",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7da0-a373-11d4250b5f03",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-799d-988e-9accd23fd223",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7441-b0d7-534d05f30dde",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7821-807e-b79719afdcb6",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 7,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7c6e-8b7e-b38e9601b2de",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-72ee-95eb-8a3badea6505",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-746b-9216-a900fb4f4572",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7654-b61e-a1305e033307",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 3,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "19:30",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 5,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "19:30",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7ee0-8a02-43cd8fee2b32",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 1,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7874-a93a-ca27a2b35ccc",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 1,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-74b6-91b0-56a7bd1f0b78",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7ae1-911e-508299d634e5",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7237-a369-812b8a2fdd6a",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 1,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-74c3-bedd-1f40795cbefd",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-75db-bd90-0e76b55fd164",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 3,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 5,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7c4c-925c-ec8c23d31f57",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 1,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7c9e-9a54-9b16855e4929",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 3,
        "classStartsLocal": "19:30",
        "classEndsLocal": "21:00",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 5,
        "classStartsLocal": "19:30",
        "classEndsLocal": "21:00",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-78d1-9872-9c446d04afd2",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 3,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "19:30",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "19:30",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 6,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:30",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7158-80dc-a76c1c4265d0",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "19:30",
        "classEndsLocal": "21:00",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "19:30",
        "classEndsLocal": "21:00",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7beb-8830-14b9f19326a7",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7abf-9368-e80b9676c856",
    "pathCode": "little-piner-piano",
    "expectedWeeklyCommitment": 1,
    "placements": [
      {
        "weekdayIso": 5,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7577-bf90-fce2314bb9e1",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 4,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "19:30",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 5,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "19:30",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7c10-b869-4b5d54dbe1e2",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 1,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-758c-9767-c7f9e5473068",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 1,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7f4d-b6b6-a277593855eb",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 3,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "19:00",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "19:00",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7cff-94a1-33b94e1e44f5",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7357-8696-58a0d03dc56b",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 6,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      },
      {
        "weekdayIso": 7,
        "classStartsLocal": null,
        "classEndsLocal": null,
        "plannedEntryLocalTime": "18:00",
        "plannedDurationMinutes": 90
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-76c0-85e8-0a22d527b123",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 1,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7a39-a6fb-13bb2d198891",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 1,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 3,
        "classStartsLocal": "18:00",
        "classEndsLocal": "19:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  },
  {
    "subscriptionId": "01a03b5d-d400-7e2d-8715-3c201ba3a44a",
    "pathCode": "little-piner-art",
    "expectedWeeklyCommitment": 2,
    "placements": [
      {
        "weekdayIso": 2,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      },
      {
        "weekdayIso": 4,
        "classStartsLocal": "19:00",
        "classEndsLocal": "20:30",
        "plannedEntryLocalTime": null,
        "plannedDurationMinutes": null
      }
    ]
  }
];

export const REVIEWED_ENROLLMENT_UNRESOLVED: ReviewedEnrollmentUnresolved[] = [
  {
    "subscriptionId": "01a03b5d-d400-7949-ae00-d95553479873",
    "pathCode": "artchitect",
    "expectedWeeklyCommitment": 2,
    "reason": "DOUBLE_SESSION_ASSIGNMENT_MODEL_GAP"
  },
  {
    "subscriptionId": "01a03b5d-d400-7641-9caa-a538be562cf4",
    "pathCode": "pianohouse",
    "expectedWeeklyCommitment": 2,
    "reason": "DOUBLE_SESSION_ASSIGNMENT_MODEL_GAP"
  }
];
