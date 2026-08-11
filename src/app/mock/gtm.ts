// GTM Coverage — target vs actual distributor counts, drillable state → city → area → DB.
// Ingested from RCPL_Distributor_Onboarding_Dataset.xlsx (GTM_Coverage_Master + GTM_Target_vs_Actual).
import { DB_TYPES } from './onboarding'
import type { Partner } from '../types'

export interface GtmDb { name: string; type: string; status: 'Active' | 'In review' }
export interface GtmArea { target: number; actual: number; dbs: GtmDb[] }
export interface GtmCity { target: number; actual: number; areas?: Record<string, GtmArea> }
export interface GtmState { name: string; target: number; actual: number; cities: Record<string, GtmCity> }

export const GTM_DATA: Record<string, GtmState> = {
  AN: {
    name: "Andaman & Nicobar Islands", target: 8, actual: 3,
    cities: {
      "Port Blair": {
        target: 8, actual: 3,
        areas: {
          'Aberdeen Bazar': { target: 2, actual: 2, dbs: [{ name: "Maa & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Modern Sales Corporation", type: "GM Excl DB", status: "Active" }] },
          'Junglighat': { target: 1, actual: 1, dbs: [{ name: "Shri General Stores", type: "Traders", status: "Active" }] },
        },
      },
    },
  },
  AP: {
    name: "Andhra Pradesh", target: 49, actual: 11,
    cities: {
      Guntur: {
        target: 13, actual: 3,
        areas: {
          'Brodipet': { target: 1, actual: 1, dbs: [{ name: "Godavari Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Lakshmipuram': { target: 2, actual: 2, dbs: [{ name: "Sri Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Om Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Vijayawada: {
        target: 12, actual: 6,
        areas: {
          'Benz Circle': { target: 3, actual: 3, dbs: [{ name: "New Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Modern Traders", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "National Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Governorpet': { target: 3, actual: 3, dbs: [{ name: "National General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Sri Trading Co.", type: "Traders", status: "Active" }, { name: "New Agencies", type: "Traders", status: "Active" }] },
        },
      },
      Visakhapatnam: {
        target: 24, actual: 2,
        areas: {
          'Dwaraka Nagar': { target: 1, actual: 1, dbs: [{ name: "Sri Agencies", type: "GM Excl DB", status: "Active" }] },
          'MVP Colony': { target: 1, actual: 1, dbs: [{ name: "New Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  AR: {
    name: "Arunachal Pradesh", target: 2, actual: 3,
    cities: {
      Itanagar: {
        target: 2, actual: 3,
        areas: {
          'Ganga Market': { target: 3, actual: 3, dbs: [{ name: "Royal Trading Co.", type: "GM Excl DB", status: "Active" }, { name: "United Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Modern Enterprises", type: "GM Excl DB", status: "Active" }] },
          'Naharlagun': { target: 2, actual: 0, dbs: [{ name: "Deccan Traders", type: "GT DB (with CSO/DSM)", status: "In review" }, { name: "Jai Traders", type: "GM Excl DB", status: "In review" }] },
        },
      },
    },
  },
  AS: {
    name: "Assam", target: 39, actual: 7,
    cities: {
      Dibrugarh: {
        target: 5, actual: 3,
        areas: {
          'Chowkidinghee': { target: 1, actual: 1, dbs: [{ name: "New Sales Corporation", type: "Traders", status: "Active" }] },
          'Graham Bazar': { target: 2, actual: 2, dbs: [{ name: "United General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Godavari Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Guwahati: {
        target: 34, actual: 4,
        areas: {
          'Fancy Bazar': { target: 1, actual: 1, dbs: [{ name: "Om General Stores", type: "GM Excl DB", status: "Active" }] },
          'Paltan Bazar': { target: 3, actual: 3, dbs: [{ name: "Jai Distributors", type: "Traders", status: "Active" }, { name: "Royal Traders", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Prime & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  BR: {
    name: "Bihar", target: 27, actual: 6,
    cities: {
      Muzaffarpur: {
        target: 3, actual: 2,
        areas: {
          'Motijheel': { target: 1, actual: 1, dbs: [{ name: "Maa Sales Corporation", type: "Traders", status: "Active" }] },
          'Saraiyaganj': { target: 1, actual: 1, dbs: [{ name: "Deccan Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Patna: {
        target: 24, actual: 4,
        areas: {
          'Boring Road': { target: 1, actual: 1, dbs: [{ name: "Modern Sales Corporation", type: "GM Excl DB", status: "Active" }] },
          'Kankarbagh': { target: 3, actual: 3, dbs: [{ name: "Royal Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shree Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Jai Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  CG: {
    name: "Chhattisgarh", target: 13, actual: 7,
    cities: {
      Bilaspur: {
        target: 2, actual: 3,
        areas: {
          'Link Road': { target: 1, actual: 1, dbs: [{ name: "Deccan Sales Corporation", type: "Traders", status: "Active" }] },
          'Vyapar Vihar': { target: 2, actual: 2, dbs: [{ name: "Maa & Sons", type: "GM Excl DB", status: "Active" }, { name: "Om Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Raipur: {
        target: 11, actual: 4,
        areas: {
          'Pandri': { target: 2, actual: 2, dbs: [{ name: "Sri Trading Co.", type: "Traders", status: "Active" }, { name: "Godavari Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Shankar Nagar': { target: 2, actual: 2, dbs: [{ name: "Modern Traders", type: "Traders", status: "Active" }, { name: "Krishna Sales Corporation", type: "GM Excl DB", status: "Active" }] },
        },
      },
    },
  },
  CH: {
    name: "Chandigarh", target: 32, actual: 4,
    cities: {
      Chandigarh: {
        target: 32, actual: 4,
        areas: {
          'Sector 17': { target: 2, actual: 2, dbs: [{ name: "Om Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Deccan Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Sector 22': { target: 2, actual: 2, dbs: [{ name: "Deccan & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Royal Marketing", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  DH: {
    name: "Dadra & Nagar Haveli and Daman & Diu", target: 6, actual: 2,
    cities: {
      Daman: {
        target: 6, actual: 2,
        areas: {
          'Moti Daman': { target: 1, actual: 1, dbs: [{ name: "Jai Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Nani Daman': { target: 1, actual: 1, dbs: [{ name: "National Distributors", type: "GM Excl DB", status: "Active" }] },
        },
      },
    },
  },
  DL: {
    name: "Delhi (NCT)", target: 29, actual: 6,
    cities: {
      "New Delhi": {
        target: 29, actual: 6,
        areas: {
          'Connaught Place': { target: 3, actual: 3, dbs: [{ name: "Krishna Commercial Agency", type: "Traders", status: "Active" }, { name: "Deccan & Sons", type: "GM Excl DB", status: "Active" }, { name: "Shree Marketing", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Dwarka': { target: 2, actual: 2, dbs: [{ name: "Shri Distributors", type: "Traders", status: "Active" }, { name: "New Trading Co.", type: "GM Excl DB", status: "Active" }] },
          'Karol Bagh': { target: 2, actual: 1, dbs: [{ name: "Jai & Sons", type: "Traders", status: "Active" }, { name: "Jai Marketing", type: "GT DB (with CSO/DSM)", status: "In review" }] },
        },
      },
    },
  },
  GA: {
    name: "Goa", target: 15, actual: 8,
    cities: {
      Margao: {
        target: 5, actual: 4,
        areas: {
          'Borda': { target: 3, actual: 3, dbs: [{ name: "Maa Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Krishna Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "National Traders", type: "Traders", status: "Active" }] },
          'Comba': { target: 1, actual: 1, dbs: [{ name: "Shri Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Panaji: {
        target: 10, actual: 4,
        areas: {
          'Fontainhas': { target: 1, actual: 1, dbs: [{ name: "Krishna General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Miramar': { target: 3, actual: 3, dbs: [{ name: "United Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Royal Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "United Sales Corporation", type: "Traders", status: "Active" }] },
        },
      },
    },
  },
  GJ: {
    name: "Gujarat", target: 32, actual: 12,
    cities: {
      Ahmedabad: {
        target: 13, actual: 3,
        areas: {
          'Maninagar': { target: 2, actual: 1, dbs: [{ name: "Royal Trading Co.", type: "GM Excl DB", status: "In review" }, { name: "Ganga Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Navrangpura': { target: 2, actual: 2, dbs: [{ name: "Ganga Traders", type: "Traders", status: "Active" }, { name: "Shree Distributors", type: "Traders", status: "Active" }] },
        },
      },
      Rajkot: {
        target: 5, actual: 3,
        areas: {
          'Kalawad Road': { target: 1, actual: 1, dbs: [{ name: "Sri Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'University Road': { target: 3, actual: 2, dbs: [{ name: "Godavari Sales Corporation", type: "GT DB (with CSO/DSM)", status: "In review" }, { name: "Shri & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Sri Traders", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Surat: {
        target: 14, actual: 6,
        areas: {
          'Adajan': { target: 3, actual: 3, dbs: [{ name: "United Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Modern Agencies", type: "Traders", status: "Active" }, { name: "Deccan & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Varachha': { target: 3, actual: 3, dbs: [{ name: "Ganga Traders", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Jai Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "National Traders", type: "GM Excl DB", status: "Active" }] },
        },
      },
    },
  },
  HP: {
    name: "Himachal Pradesh", target: 16, actual: 6,
    cities: {
      Shimla: {
        target: 14, actual: 3,
        areas: {
          'Lower Bazaar': { target: 2, actual: 2, dbs: [{ name: "Prime Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Royal Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Sanjauli': { target: 1, actual: 1, dbs: [{ name: "Shri & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Solan: {
        target: 2, actual: 3,
        areas: {
          'Rajgarh Road': { target: 2, actual: 2, dbs: [{ name: "Om Traders", type: "Traders", status: "Active" }, { name: "Shri & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'The Mall': { target: 1, actual: 1, dbs: [{ name: "Om General Stores", type: "GM Excl DB", status: "Active" }] },
        },
      },
    },
  },
  HR: {
    name: "Haryana", target: 21, actual: 8,
    cities: {
      Faridabad: {
        target: 6, actual: 4,
        areas: {
          'NIT': { target: 2, actual: 2, dbs: [{ name: "Shree Distributors", type: "Traders", status: "Active" }, { name: "Modern Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Sector 15': { target: 2, actual: 2, dbs: [{ name: "Krishna General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Royal General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Gurugram: {
        target: 15, actual: 4,
        areas: {
          'DLF Phase 3': { target: 2, actual: 2, dbs: [{ name: "Prime Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shri Trading Co.", type: "GM Excl DB", status: "Active" }] },
          'Sector 14': { target: 2, actual: 2, dbs: [{ name: "United Sales Corporation", type: "Traders", status: "Active" }, { name: "United Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  JH: {
    name: "Jharkhand", target: 17, actual: 6,
    cities: {
      Jamshedpur: {
        target: 8, actual: 3,
        areas: {
          'Bistupur': { target: 2, actual: 2, dbs: [{ name: "Prime Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Ganga Agencies", type: "Traders", status: "Active" }] },
          'Sakchi': { target: 1, actual: 1, dbs: [{ name: "Ganga Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Ranchi: {
        target: 9, actual: 3,
        areas: {
          'Lalpur': { target: 2, actual: 2, dbs: [{ name: "Krishna Enterprises", type: "GM Excl DB", status: "Active" }, { name: "Sri General Stores", type: "Traders", status: "Active" }] },
          'Main Road': { target: 1, actual: 1, dbs: [{ name: "Shri & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  JK: {
    name: "Jammu & Kashmir", target: 13, actual: 8,
    cities: {
      Jammu: {
        target: 7, actual: 4,
        areas: {
          'Gandhi Nagar': { target: 2, actual: 2, dbs: [{ name: "Om Traders", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Prime Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Residency Road': { target: 2, actual: 2, dbs: [{ name: "Royal Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shri Marketing", type: "Traders", status: "Active" }] },
        },
      },
      Srinagar: {
        target: 6, actual: 4,
        areas: {
          'Lal Chowk': { target: 2, actual: 2, dbs: [{ name: "Godavari Marketing", type: "Traders", status: "Active" }, { name: "Modern Sales Corporation", type: "GM Excl DB", status: "Active" }] },
          'Rajbagh': { target: 2, actual: 2, dbs: [{ name: "New General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Om Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  KA: {
    name: "Karnataka", target: 23, actual: 7,
    cities: {
      Bengaluru: {
        target: 18, actual: 5,
        areas: {
          'Jayanagar': { target: 2, actual: 2, dbs: [{ name: "Shri Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Sri Traders", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Koramangala': { target: 2, actual: 2, dbs: [{ name: "Prime Enterprises", type: "Traders", status: "Active" }, { name: "Shri Enterprises", type: "Traders", status: "Active" }] },
          'Whitefield': { target: 2, actual: 1, dbs: [{ name: "Deccan & Sons", type: "GT DB (with CSO/DSM)", status: "In review" }, { name: "Ganga Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Mysuru: {
        target: 5, actual: 2,
        areas: {
          'Saraswathipuram': { target: 1, actual: 1, dbs: [{ name: "Prime Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Vijayanagar': { target: 1, actual: 1, dbs: [{ name: "Prime Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  KL: {
    name: "Kerala", target: 63, actual: 5,
    cities: {
      Kochi: {
        target: 30, actual: 3,
        areas: {
          'Edapally': { target: 2, actual: 2, dbs: [{ name: "United Agencies", type: "Traders", status: "Active" }, { name: "National Enterprises", type: "Traders", status: "Active" }] },
          'MG Road': { target: 1, actual: 1, dbs: [{ name: "Prime Distributors", type: "Traders", status: "Active" }] },
        },
      },
      Thiruvananthapuram: {
        target: 33, actual: 2,
        areas: {
          'Palayam': { target: 1, actual: 1, dbs: [{ name: "Om & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Vazhuthacaud': { target: 2, actual: 1, dbs: [{ name: "Ganga Enterprises", type: "GT DB (with CSO/DSM)", status: "In review" }, { name: "Maa Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  LA: {
    name: "Ladakh", target: 4, actual: 3,
    cities: {
      Leh: {
        target: 4, actual: 3,
        areas: {
          'Main Bazaar': { target: 2, actual: 2, dbs: [{ name: "Jai Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Royal & Sons", type: "GM Excl DB", status: "Active" }] },
          'Sankar': { target: 1, actual: 1, dbs: [{ name: "Maa Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  LD: {
    name: "Lakshadweep", target: 8, actual: 1,
    cities: {
      Kavaratti: {
        target: 8, actual: 1,
        areas: {
          'Main Town': { target: 1, actual: 1, dbs: [{ name: "Godavari Distributors", type: "GM Excl DB", status: "Active" }] },
        },
      },
    },
  },
  MH: {
    name: "Maharashtra", target: 82, actual: 18,
    cities: {
      Aurangabad: {
        target: 2, actual: 5,
        areas: {
          'Cidco': { target: 3, actual: 2, dbs: [{ name: "National Sales Corporation", type: "Traders", status: "In review" }, { name: "Ganga Distributors", type: "Traders", status: "Active" }, { name: "Ganga Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Osmanpura': { target: 3, actual: 3, dbs: [{ name: "Shri Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "National General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "New General Stores", type: "GM Excl DB", status: "Active" }] },
        },
      },
      Mumbai: {
        target: 25, actual: 5,
        areas: {
          'Andheri': { target: 1, actual: 0, dbs: [{ name: "Shree General Stores", type: "GT DB (with CSO/DSM)", status: "In review" }] },
          'Bandra': { target: 3, actual: 3, dbs: [{ name: "Shri Marketing", type: "GM Excl DB", status: "Active" }, { name: "Sri & Sons", type: "Traders", status: "Active" }, { name: "Modern Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Dadar': { target: 2, actual: 2, dbs: [{ name: "Sri Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "New Commercial Agency", type: "Traders", status: "Active" }] },
        },
      },
      Nagpur: {
        target: 14, actual: 2,
        areas: {
          'Dharampeth': { target: 1, actual: 1, dbs: [{ name: "Modern Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Sitabuldi': { target: 2, actual: 1, dbs: [{ name: "Shree Traders", type: "GT DB (with CSO/DSM)", status: "In review" }, { name: "Royal Enterprises", type: "Traders", status: "Active" }] },
        },
      },
      Nashik: {
        target: 12, actual: 4,
        areas: {
          'Nashik City': { target: 2, actual: 2, dbs: [{ name: "Modern Marketing", type: "GM Excl DB", status: "Active" }, { name: "Modern Agencies", type: "GM Excl DB", status: "Active" }] },
          'Panchavati': { target: 2, actual: 2, dbs: [{ name: "Krishna Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Modern Marketing", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Pune: {
        target: 29, actual: 2,
        areas: {
          'Camp': { target: 1, actual: 1, dbs: [{ name: "Shri Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Kothrud': { target: 1, actual: 1, dbs: [{ name: "Ganga Sales Corporation", type: "Traders", status: "Active" }] },
        },
      },
    },
  },
  ML: {
    name: "Meghalaya", target: 2, actual: 3,
    cities: {
      Shillong: {
        target: 2, actual: 3,
        areas: {
          'Laitumkhrah': { target: 2, actual: 1, dbs: [{ name: "Jai Commercial Agency", type: "GM Excl DB", status: "Active" }, { name: "Om & Sons", type: "GT DB (with CSO/DSM)", status: "In review" }] },
          'Police Bazar': { target: 2, actual: 2, dbs: [{ name: "Royal & Sons", type: "Traders", status: "Active" }, { name: "Krishna Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  MN: {
    name: "Manipur", target: 7, actual: 4,
    cities: {
      Imphal: {
        target: 7, actual: 4,
        areas: {
          'Paona Bazar': { target: 2, actual: 2, dbs: [{ name: "Deccan Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Sri Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Thangal Bazar': { target: 2, actual: 2, dbs: [{ name: "Jai Distributors", type: "Traders", status: "Active" }, { name: "Shree Marketing", type: "GM Excl DB", status: "Active" }] },
        },
      },
    },
  },
  MP: {
    name: "Madhya Pradesh", target: 28, actual: 7,
    cities: {
      Bhopal: {
        target: 12, actual: 2,
        areas: {
          'MP Nagar': { target: 1, actual: 1, dbs: [{ name: "Maa Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'New Market': { target: 1, actual: 1, dbs: [{ name: "Modern Sales Corporation", type: "Traders", status: "Active" }] },
        },
      },
      Indore: {
        target: 16, actual: 5,
        areas: {
          'Rajwada': { target: 2, actual: 2, dbs: [{ name: "Prime General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shri Traders", type: "Traders", status: "Active" }] },
          'Vijay Nagar': { target: 3, actual: 3, dbs: [{ name: "Prime & Sons", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Om Enterprises", type: "GM Excl DB", status: "Active" }, { name: "Modern Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  MZ: {
    name: "Mizoram", target: 7, actual: 4,
    cities: {
      Aizawl: {
        target: 7, actual: 4,
        areas: {
          'Chanmari': { target: 2, actual: 2, dbs: [{ name: "Modern Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Deccan Marketing", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Dawrpui': { target: 2, actual: 2, dbs: [{ name: "Shri Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Ganga Marketing", type: "Traders", status: "Active" }] },
        },
      },
    },
  },
  NL: {
    name: "Nagaland", target: 4, actual: 3,
    cities: {
      Kohima: {
        target: 4, actual: 3,
        areas: {
          'Main Town': { target: 2, actual: 2, dbs: [{ name: "Om Enterprises", type: "Traders", status: "Active" }, { name: "Godavari Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'PR Hill': { target: 1, actual: 1, dbs: [{ name: "Godavari Trading Co.", type: "GM Excl DB", status: "Active" }] },
        },
      },
    },
  },
  OD: {
    name: "Odisha", target: 19, actual: 5,
    cities: {
      Bhubaneswar: {
        target: 8, actual: 1,
        areas: {
          'Rasulgarh': { target: 1, actual: 1, dbs: [{ name: "Krishna Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Saheed Nagar': { target: 1, actual: 0, dbs: [{ name: "Jai & Sons", type: "Traders", status: "In review" }] },
        },
      },
      Cuttack: {
        target: 11, actual: 4,
        areas: {
          'Buxi Bazar': { target: 2, actual: 2, dbs: [{ name: "Prime Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shree Agencies", type: "Traders", status: "Active" }] },
          'Link Road': { target: 2, actual: 2, dbs: [{ name: "Shri Marketing", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Om Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  PB: {
    name: "Punjab", target: 18, actual: 8,
    cities: {
      Amritsar: {
        target: 10, actual: 2,
        areas: {
          'Hall Bazaar': { target: 1, actual: 1, dbs: [{ name: "Royal Traders", type: "GM Excl DB", status: "Active" }] },
          'Ranjit Avenue': { target: 1, actual: 1, dbs: [{ name: "Jai Enterprises", type: "GM Excl DB", status: "Active" }] },
        },
      },
      Ludhiana: {
        target: 8, actual: 6,
        areas: {
          'Model Town': { target: 3, actual: 3, dbs: [{ name: "Ganga Commercial Agency", type: "GM Excl DB", status: "Active" }, { name: "Shree Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Deccan Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Sarabha Nagar': { target: 3, actual: 3, dbs: [{ name: "Om Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "United Distributors", type: "Traders", status: "Active" }, { name: "New Trading Co.", type: "Traders", status: "Active" }] },
        },
      },
    },
  },
  PY: {
    name: "Puducherry", target: 8, actual: 4,
    cities: {
      Puducherry: {
        target: 8, actual: 4,
        areas: {
          'Lawspet': { target: 1, actual: 1, dbs: [{ name: "National Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'White Town': { target: 3, actual: 3, dbs: [{ name: "Ganga General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shree Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Royal Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  RJ: {
    name: "Rajasthan", target: 39, actual: 6,
    cities: {
      Jaipur: {
        target: 32, actual: 3,
        areas: {
          'C-Scheme': { target: 1, actual: 1, dbs: [{ name: "Krishna Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Malviya Nagar': { target: 2, actual: 2, dbs: [{ name: "Om Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Royal Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Jodhpur: {
        target: 7, actual: 3,
        areas: {
          'Ratanada': { target: 2, actual: 2, dbs: [{ name: "Shree Marketing", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shree Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Sardarpura': { target: 1, actual: 1, dbs: [{ name: "Prime Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  SK: {
    name: "Sikkim", target: 8, actual: 4,
    cities: {
      Gangtok: {
        target: 8, actual: 4,
        areas: {
          'Development Area': { target: 3, actual: 2, dbs: [{ name: "Prime Commercial Agency", type: "GT DB (with CSO/DSM)", status: "In review" }, { name: "Prime Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Maa Distributors", type: "GM Excl DB", status: "Active" }] },
          'MG Marg': { target: 2, actual: 2, dbs: [{ name: "Jai Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Royal General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  TN: {
    name: "Tamil Nadu", target: 44, actual: 4,
    cities: {
      Chennai: {
        target: 33, actual: 2,
        areas: {
          'Anna Nagar': { target: 1, actual: 1, dbs: [{ name: "Royal Agencies", type: "Traders", status: "Active" }] },
          'T Nagar': { target: 2, actual: 1, dbs: [{ name: "Modern Distributors", type: "GM Excl DB", status: "In review" }, { name: "Shri Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Coimbatore: {
        target: 11, actual: 2,
        areas: {
          'Gandhipuram': { target: 1, actual: 1, dbs: [{ name: "Maa Enterprises", type: "GM Excl DB", status: "Active" }] },
          'RS Puram': { target: 1, actual: 1, dbs: [{ name: "United Traders", type: "Traders", status: "Active" }] },
        },
      },
    },
  },
  TR: {
    name: "Tripura", target: 2, actual: 5,
    cities: {
      Agartala: {
        target: 2, actual: 5,
        areas: {
          'Krishnanagar': { target: 3, actual: 3, dbs: [{ name: "United General Stores", type: "Traders", status: "Active" }, { name: "Deccan Agencies", type: "GM Excl DB", status: "Active" }, { name: "Royal Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Ronaldsay Road': { target: 2, actual: 2, dbs: [{ name: "Jai Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Sri Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  TS: {
    name: "Telangana", target: 26, actual: 5,
    cities: {
      Hyderabad: {
        target: 26, actual: 5,
        areas: {
          'Ameerpet': { target: 1, actual: 1, dbs: [{ name: "Maa Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Kukatpally': { target: 1, actual: 1, dbs: [{ name: "National Sales Corporation", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Secunderabad': { target: 3, actual: 3, dbs: [{ name: "Krishna Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shri Marketing", type: "Traders", status: "Active" }, { name: "Ganga Agencies", type: "GM Excl DB", status: "Active" }] },
        },
      },
    },
  },
  UK: {
    name: "Uttarakhand", target: 14, actual: 7,
    cities: {
      Dehradun: {
        target: 7, actual: 4,
        areas: {
          'Clement Town': { target: 2, actual: 2, dbs: [{ name: "Om General Stores", type: "GM Excl DB", status: "Active" }, { name: "Deccan Enterprises", type: "Traders", status: "Active" }] },
          'Rajpur Road': { target: 2, actual: 2, dbs: [{ name: "National Marketing", type: "Traders", status: "Active" }, { name: "Shree Distributors", type: "Traders", status: "Active" }] },
        },
      },
      Haridwar: {
        target: 7, actual: 3,
        areas: {
          'Jwalapur': { target: 3, actual: 2, dbs: [{ name: "Maa Sales Corporation", type: "GT DB (with CSO/DSM)", status: "In review" }, { name: "Prime Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Godavari Sales Corporation", type: "GM Excl DB", status: "Active" }] },
          'Ranipur': { target: 1, actual: 1, dbs: [{ name: "Royal Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  UP: {
    name: "Uttar Pradesh", target: 63, actual: 12,
    cities: {
      Kanpur: {
        target: 12, actual: 4,
        areas: {
          'Civil Lines': { target: 2, actual: 2, dbs: [{ name: "Shri Distributors", type: "Traders", status: "Active" }, { name: "Jai Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Swaroop Nagar': { target: 2, actual: 2, dbs: [{ name: "Royal Enterprises", type: "Traders", status: "Active" }, { name: "Prime Enterprises", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Lucknow: {
        target: 24, actual: 4,
        areas: {
          'Gomti Nagar': { target: 2, actual: 2, dbs: [{ name: "Maa & Sons", type: "Traders", status: "Active" }, { name: "Modern Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Hazratganj': { target: 2, actual: 2, dbs: [{ name: "Prime Sales Corporation", type: "GM Excl DB", status: "Active" }, { name: "Modern Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
      Noida: {
        target: 27, actual: 4,
        areas: {
          'Sector 18': { target: 1, actual: 1, dbs: [{ name: "Sri Traders", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Sector 62': { target: 3, actual: 3, dbs: [{ name: "Sri Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "New Agencies", type: "Traders", status: "Active" }, { name: "Modern Marketing", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
  WB: {
    name: "West Bengal", target: 36, actual: 12,
    cities: {
      Kolkata: {
        target: 22, actual: 7,
        areas: {
          'Behala': { target: 3, actual: 3, dbs: [{ name: "Shri Distributors", type: "Traders", status: "Active" }, { name: "New & Sons", type: "Traders", status: "Active" }, { name: "Deccan Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Park Street': { target: 1, actual: 1, dbs: [{ name: "Jai General Stores", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Salt Lake': { target: 3, actual: 3, dbs: [{ name: "Maa Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "United Traders", type: "GM Excl DB", status: "Active" }, { name: "Maa Trading Co.", type: "Traders", status: "Active" }] },
        },
      },
      Siliguri: {
        target: 14, actual: 5,
        areas: {
          'Hill Cart Road': { target: 3, actual: 3, dbs: [{ name: "United Trading Co.", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "Shree General Stores", type: "Traders", status: "Active" }, { name: "Sri Distributors", type: "GT DB (with CSO/DSM)", status: "Active" }] },
          'Sevoke Road': { target: 2, actual: 2, dbs: [{ name: "Shree Agencies", type: "GT DB (with CSO/DSM)", status: "Active" }, { name: "New Commercial Agency", type: "GT DB (with CSO/DSM)", status: "Active" }] },
        },
      },
    },
  },
}

// Approximate geographic coordinates (lon, lat) for mapped cities.
// labelSide places each label where it won't collide with a neighbour.
export type MapLabelSide = 'left' | 'right' | 'top' | 'bottom'

// City-level GTM coverage across India — drives the Partner map, the summary tiles,
// Top gaps and the factors comparison. Coverage tiers: ≥100% met · 50–99% partial · <50% gap.
export interface GtmCityInfo {
  city: string; stateCode: string
  target: number; actual: number
  lon: number; lat: number; labelSide?: MapLabelSide
}
export const GTM_CITIES: GtmCityInfo[] = [
  { city: "Port Blair", stateCode: "AN", target: 8, actual: 3, lon: 92.72, lat: 11.62, labelSide: "right" },
  { city: "Guntur", stateCode: "AP", target: 13, actual: 3, lon: 80.44, lat: 16.3, labelSide: "right" },
  { city: "Vijayawada", stateCode: "AP", target: 12, actual: 6, lon: 80.65, lat: 16.51, labelSide: "right" },
  { city: "Visakhapatnam", stateCode: "AP", target: 24, actual: 2, lon: 83.22, lat: 17.69, labelSide: "right" },
  { city: "Itanagar", stateCode: "AR", target: 2, actual: 3, lon: 93.62, lat: 27.1, labelSide: "right" },
  { city: "Dibrugarh", stateCode: "AS", target: 5, actual: 3, lon: 94.9, lat: 27.48, labelSide: "right" },
  { city: "Guwahati", stateCode: "AS", target: 34, actual: 4, lon: 91.74, lat: 26.14, labelSide: "right" },
  { city: "Muzaffarpur", stateCode: "BR", target: 3, actual: 2, lon: 85.39, lat: 26.12, labelSide: "right" },
  { city: "Patna", stateCode: "BR", target: 24, actual: 4, lon: 85.14, lat: 25.59, labelSide: "right" },
  { city: "Bilaspur", stateCode: "CG", target: 2, actual: 3, lon: 82.15, lat: 22.09, labelSide: "right" },
  { city: "Raipur", stateCode: "CG", target: 11, actual: 4, lon: 81.63, lat: 21.25, labelSide: "right" },
  { city: "Chandigarh", stateCode: "CH", target: 32, actual: 4, lon: 76.78, lat: 30.73, labelSide: "right" },
  { city: "Daman", stateCode: "DH", target: 6, actual: 2, lon: 72.83, lat: 20.4, labelSide: "left" },
  { city: "New Delhi", stateCode: "DL", target: 29, actual: 6, lon: 77.1, lat: 28.61, labelSide: "right" },
  { city: "Margao", stateCode: "GA", target: 5, actual: 4, lon: 73.96, lat: 15.27, labelSide: "left" },
  { city: "Panaji", stateCode: "GA", target: 10, actual: 4, lon: 73.83, lat: 15.49, labelSide: "left" },
  { city: "Ahmedabad", stateCode: "GJ", target: 13, actual: 3, lon: 72.57, lat: 23.02, labelSide: "left" },
  { city: "Rajkot", stateCode: "GJ", target: 5, actual: 3, lon: 70.8, lat: 22.3, labelSide: "left" },
  { city: "Surat", stateCode: "GJ", target: 14, actual: 6, lon: 72.83, lat: 21.17, labelSide: "left" },
  { city: "Shimla", stateCode: "HP", target: 14, actual: 3, lon: 77.17, lat: 31.1, labelSide: "right" },
  { city: "Solan", stateCode: "HP", target: 2, actual: 3, lon: 77.1, lat: 30.9, labelSide: "right" },
  { city: "Faridabad", stateCode: "HR", target: 6, actual: 4, lon: 77.32, lat: 28.41, labelSide: "left" },
  { city: "Gurugram", stateCode: "HR", target: 15, actual: 4, lon: 77.03, lat: 28.46, labelSide: "left" },
  { city: "Jamshedpur", stateCode: "JH", target: 8, actual: 3, lon: 86.18, lat: 22.8, labelSide: "right" },
  { city: "Ranchi", stateCode: "JH", target: 9, actual: 3, lon: 85.32, lat: 23.34, labelSide: "right" },
  { city: "Jammu", stateCode: "JK", target: 7, actual: 4, lon: 74.87, lat: 32.73, labelSide: "left" },
  { city: "Srinagar", stateCode: "JK", target: 6, actual: 4, lon: 74.79, lat: 34.08, labelSide: "left" },
  { city: "Bengaluru", stateCode: "KA", target: 18, actual: 5, lon: 77.59, lat: 12.97, labelSide: "left" },
  { city: "Mysuru", stateCode: "KA", target: 5, actual: 2, lon: 76.65, lat: 12.3, labelSide: "left" },
  { city: "Kochi", stateCode: "KL", target: 30, actual: 3, lon: 76.27, lat: 9.93, labelSide: "right" },
  { city: "Thiruvananthapuram", stateCode: "KL", target: 33, actual: 2, lon: 76.94, lat: 8.52, labelSide: "right" },
  { city: "Leh", stateCode: "LA", target: 4, actual: 3, lon: 77.58, lat: 34.15, labelSide: "right" },
  { city: "Kavaratti", stateCode: "LD", target: 8, actual: 1, lon: 72.64, lat: 10.57, labelSide: "left" },
  { city: "Aurangabad", stateCode: "MH", target: 2, actual: 5, lon: 75.34, lat: 19.88, labelSide: "bottom" },
  { city: "Mumbai", stateCode: "MH", target: 25, actual: 5, lon: 72.88, lat: 19.08, labelSide: "left" },
  { city: "Nagpur", stateCode: "MH", target: 14, actual: 2, lon: 79.09, lat: 21.15, labelSide: "right" },
  { city: "Nashik", stateCode: "MH", target: 12, actual: 4, lon: 73.79, lat: 20.0, labelSide: "left" },
  { city: "Pune", stateCode: "MH", target: 29, actual: 2, lon: 73.86, lat: 18.52, labelSide: "bottom" },
  { city: "Shillong", stateCode: "ML", target: 2, actual: 3, lon: 91.89, lat: 25.58, labelSide: "right" },
  { city: "Imphal", stateCode: "MN", target: 7, actual: 4, lon: 93.94, lat: 24.82, labelSide: "right" },
  { city: "Bhopal", stateCode: "MP", target: 12, actual: 2, lon: 77.41, lat: 23.26, labelSide: "right" },
  { city: "Indore", stateCode: "MP", target: 16, actual: 5, lon: 75.86, lat: 22.72, labelSide: "bottom" },
  { city: "Aizawl", stateCode: "MZ", target: 7, actual: 4, lon: 92.72, lat: 23.73, labelSide: "right" },
  { city: "Kohima", stateCode: "NL", target: 4, actual: 3, lon: 94.11, lat: 25.67, labelSide: "right" },
  { city: "Bhubaneswar", stateCode: "OD", target: 8, actual: 1, lon: 85.83, lat: 20.3, labelSide: "right" },
  { city: "Cuttack", stateCode: "OD", target: 11, actual: 4, lon: 85.88, lat: 20.47, labelSide: "right" },
  { city: "Amritsar", stateCode: "PB", target: 10, actual: 2, lon: 74.87, lat: 31.63, labelSide: "left" },
  { city: "Ludhiana", stateCode: "PB", target: 8, actual: 6, lon: 75.86, lat: 30.9, labelSide: "left" },
  { city: "Puducherry", stateCode: "PY", target: 8, actual: 4, lon: 79.83, lat: 11.94, labelSide: "right" },
  { city: "Jaipur", stateCode: "RJ", target: 32, actual: 3, lon: 75.79, lat: 26.91, labelSide: "left" },
  { city: "Jodhpur", stateCode: "RJ", target: 7, actual: 3, lon: 73.02, lat: 26.24, labelSide: "right" },
  { city: "Gangtok", stateCode: "SK", target: 8, actual: 4, lon: 88.61, lat: 27.34, labelSide: "right" },
  { city: "Chennai", stateCode: "TN", target: 33, actual: 2, lon: 80.27, lat: 13.08, labelSide: "right" },
  { city: "Coimbatore", stateCode: "TN", target: 11, actual: 2, lon: 76.96, lat: 11.02, labelSide: "left" },
  { city: "Agartala", stateCode: "TR", target: 2, actual: 5, lon: 91.28, lat: 23.84, labelSide: "right" },
  { city: "Hyderabad", stateCode: "TS", target: 26, actual: 5, lon: 78.49, lat: 17.38, labelSide: "right" },
  { city: "Dehradun", stateCode: "UK", target: 7, actual: 4, lon: 78.03, lat: 30.32, labelSide: "right" },
  { city: "Haridwar", stateCode: "UK", target: 7, actual: 3, lon: 78.17, lat: 29.95, labelSide: "right" },
  { city: "Kanpur", stateCode: "UP", target: 12, actual: 4, lon: 80.35, lat: 26.45, labelSide: "right" },
  { city: "Lucknow", stateCode: "UP", target: 24, actual: 4, lon: 80.95, lat: 26.85, labelSide: "right" },
  { city: "Noida", stateCode: "UP", target: 27, actual: 4, lon: 77.33, lat: 28.54, labelSide: "right" },
  { city: "Kolkata", stateCode: "WB", target: 22, actual: 7, lon: 88.36, lat: 22.57, labelSide: "right" },
  { city: "Siliguri", stateCode: "WB", target: 14, actual: 5, lon: 88.43, lat: 26.73, labelSide: "right" },
]

// GTM factors compared per location vs plan. `perTarget` scales a factor's plan number off the
// city's distributor target; `delta` shifts that factor's coverage vs the city's overall coverage
// (calibrated so Mumbai reproduces the reference figures). `extra` rows hide behind "Show more".
export interface GtmFactor {
  key: string; label: string; sub: string; icon: string
  perTarget: number; delta: number; money?: boolean; extra?: boolean
}
export const GTM_FACTORS: GtmFactor[] = [
  { key: 'salesmen', label: 'Salesmen & delivery', sub: 'Total appointed', icon: 'user', perTarget: 12.5, delta: 0.252 },
  { key: 'delivery', label: 'Delivery units', sub: 'Total appointed', icon: 'target', perTarget: 6.5, delta: 0.162 },
  { key: 'godown', label: 'Godown with required space', sub: 'Total appointed', icon: 'documents', perTarget: 1.4, delta: 0.23 },
  { key: 'computer', label: 'Computer / operator availability', sub: 'Total appointed', icon: 'settings', perTarget: 1.5, delta: 0.333 },
  { key: 'credit', label: 'Credit limit availability', sub: 'Total approved', icon: 'analytics', perTarget: 2.5, delta: 0.27, money: true },
  { key: 'outlets', label: 'Outlets covered regularly', sub: 'Active beat coverage', icon: 'leads', perTarget: 60, delta: 0.2, extra: true },
  { key: 'beats', label: 'Beat plans active', sub: 'Published & running', icon: 'dashboard', perTarget: 3.2, delta: 0.18, extra: true },
  { key: 'reputation', label: 'Reputation checks completed', sub: 'Market references', icon: 'approvals', perTarget: 1, delta: 0.3, extra: true },
]

// Back-compat: coordinates for cities referenced elsewhere.
export const CITY_GEO: Record<string, { lon: number; lat: number; labelSide?: MapLabelSide }> =
  Object.fromEntries(GTM_CITIES.map((c) => [c.city, { lon: c.lon, lat: c.lat, labelSide: c.labelSide }]))

// Towns per tracked state — used to spread each state's appointed distributors across
// plausible locations in the drill-down. Ingested from GTM_Coverage_Master's City_Town values.
const STATE_TOWNS: Record<string, string[]> = {
  AN: ["Port Blair"],
  AP: ["Guntur", "Vijayawada", "Visakhapatnam"],
  AR: ["Itanagar"],
  AS: ["Dibrugarh", "Guwahati"],
  BR: ["Muzaffarpur", "Patna"],
  CG: ["Bilaspur", "Raipur"],
  CH: ["Chandigarh"],
  DH: ["Daman"],
  DL: ["New Delhi"],
  GA: ["Margao", "Panaji"],
  GJ: ["Ahmedabad", "Rajkot", "Surat"],
  HP: ["Shimla", "Solan"],
  HR: ["Faridabad", "Gurugram"],
  JH: ["Jamshedpur", "Ranchi"],
  JK: ["Jammu", "Srinagar"],
  KA: ["Bengaluru", "Mysuru"],
  KL: ["Kochi", "Thiruvananthapuram"],
  LA: ["Leh"],
  LD: ["Kavaratti"],
  MH: ["Aurangabad", "Mumbai", "Nagpur", "Nashik", "Pune"],
  ML: ["Shillong"],
  MN: ["Imphal"],
  MP: ["Bhopal", "Indore"],
  MZ: ["Aizawl"],
  NL: ["Kohima"],
  OD: ["Bhubaneswar", "Cuttack"],
  PB: ["Amritsar", "Ludhiana"],
  PY: ["Puducherry"],
  RJ: ["Jaipur", "Jodhpur"],
  SK: ["Gangtok"],
  TN: ["Chennai", "Coimbatore"],
  TR: ["Agartala"],
  TS: ["Hyderabad"],
  UK: ["Dehradun", "Haridwar"],
  UP: ["Kanpur", "Lucknow", "Noida"],
  WB: ["Kolkata", "Siliguri"],
}
// Towns that show up in grievance/case data but aren't in STATE_TOWNS' short list.
const EXTRA_TOWN_STATE: Record<string, string> = {}

// Maps a (possibly sub-area) town name — e.g. "West Mumbai", "Nashik City" — to its tracked
// state code, so grievances (which only carry a town) can be rolled up by state/region.
export function stateCodeForTown(town: string): string | undefined {
  if (EXTRA_TOWN_STATE[town]) return EXTRA_TOWN_STATE[town]
  for (const [code, towns] of Object.entries(STATE_TOWNS)) {
    if (towns.some((t) => town === t || town.includes(t))) return code
  }
  return undefined
}

const FIRM_NAMES = ['Sharma', 'Patel', 'Verma', 'Reddy', 'Iyer', 'Gupta', 'Nair', 'Mehta', 'Joshi', 'Rao', 'Agarwal', 'Bose']
const FIRM_SUFFIX = ['Distributors', 'Agencies', 'Trading Co.', 'Enterprises', 'Marketing', 'Sales Corp.']

export interface StateDb { name: string; town: string; type: string; status: 'Active' | 'In review' }
// Deterministic per state+index, so the same state always lists the same distributors.
// Only tops up a state's list when its named DBs (from GTM_DATA) fall short of the appointed count.
export function stateDistributors(code: string, count: number): StateDb[] {
  const towns = STATE_TOWNS[code] ?? ['—']
  const h = [...code].reduce((a, ch) => a + ch.charCodeAt(0), 0)
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    name: `${FIRM_NAMES[(h + i * 5) % FIRM_NAMES.length]} ${FIRM_SUFFIX[(h + i * 3) % FIRM_SUFFIX.length]}`,
    town: towns[i % towns.length],
    type: DB_TYPES[(h + i) % DB_TYPES.length],
    status: (h + i) % 4 === 0 ? 'In review' : 'Active',
  }))
}

// The live "actual" for a state — every currently-appointed (non-discontinued) distributor
// Partner in it — so GTM Coverage's numbers are always the same numbers Partners itself shows,
// instead of a separately-maintained static count that can silently drift out of sync.
export function actualDistributorsIn(partners: Partner[], code: string): number {
  return partners.filter((p) => p.state === code && p.partnerType === 'distributor' && p.status !== 'discontinued').length
}

// Same live set, shaped as StateDb rows for the "Distributors in {state}" table / city
// drill-down / channel-type donut — those only ever showed a synthetic namedDbs+filler list
// before; this makes them list the real, same partners the count above is counting.
export function distributorRowsIn(partners: Partner[], code: string): StateDb[] {
  return partners
    .filter((p) => p.state === code && p.partnerType === 'distributor' && p.status !== 'discontinued')
    .map((p) => {
      const h = [...p.legalName].reduce((a, ch) => a + ch.charCodeAt(0), 0)
      return {
        name: p.legalName, town: p.town,
        type: DB_TYPES[h % DB_TYPES.length],
        status: (p.status === 'in_review' ? 'In review' : 'Active') as 'Active' | 'In review',
      }
    })
}

// Our state codes → the ids used by the @svg-maps/india boundary paths — shared by the GTM
// Coverage choropleth and the Analytics "Coverage by Region" mini map. States/UTs with no
// distinct path in @svg-maps/india (e.g. LA — still merged into 'jk' upstream) are omitted here
// but remain fully present in GTM_DATA/STATE_TOWNS/REGION_OF for drill-downs & analytics.
export const SVG_ID: Record<string, string> = {
  AN: "an", AP: "ap", AR: "ar", AS: "as", BR: "br", CH: "ch", CG: "ct", DH: "dn", DL: "dl", GA: "ga", GJ: "gj", HR: "hr", HP: "hp", JK: "jk", JH: "jh", KA: "ka", KL: "kl", LD: "ld", MP: "mp", MH: "mh", MN: "mn", ML: "ml", MZ: "mz", NL: "nl", OD: "or", PY: "py", PB: "pb", RJ: "rj", SK: "sk", TN: "tn", TS: "tg", TR: "tr", UP: "up", UK: "ut", WB: "wb",
}

// Macro-region each tracked state rolls up into — used by the Analytics "Coverage by Region" card.
// Sourced from GTM_Coverage_Master's Zone column.
export type GtmRegion = 'North' | 'South' | 'East' | 'West' | 'Central'
export const REGION_OF: Record<string, GtmRegion> = {
  AN: "South", AP: "South", AR: "East", AS: "East", BR: "East", CG: "Central", CH: "North", DH: "West", DL: "North", GA: "West", GJ: "West", HP: "North", HR: "North", JH: "East", JK: "North", KA: "South", KL: "South", LA: "North", LD: "South", MH: "West", ML: "East", MN: "East", MP: "Central", MZ: "East", NL: "East", OD: "East", PB: "North", PY: "South", RJ: "North", SK: "East", TN: "South", TR: "East", TS: "South", UK: "North", UP: "North", WB: "East",
}

// State-level GTM coverage for the India overview choropleth (tile-grid map: each state is a
// tile at an approximate geographic grid position). target/actual omitted = no data yet.
export interface GtmStateInfo {
  code: string; name: string
  col: number; row: number
  target?: number; actual?: number
}
export const GTM_STATES: GtmStateInfo[] = [
  { code: "AN", name: "Andaman & Nicobar Islands", col: 5, row: 8, target: 8, actual: 3 },
  { code: "AP", name: "Andhra Pradesh", col: 3, row: 6, target: 49, actual: 11 },
  { code: "AR", name: "Arunachal Pradesh", col: 7, row: 2, target: 2, actual: 3 },
  { code: "AS", name: "Assam", col: 5, row: 3, target: 39, actual: 7 },
  { code: "BR", name: "Bihar", col: 3, row: 3, target: 27, actual: 6 },
  { code: "CG", name: "Chhattisgarh", col: 2, row: 4, target: 13, actual: 7 },
  { code: "CH", name: "Chandigarh", col: 1, row: 2, target: 32, actual: 4 },
  { code: "DH", name: "Dadra & Nagar Haveli and Daman & Diu", col: -1, row: 4, target: 6, actual: 2 },
  { code: "DL", name: "Delhi (NCT)", col: 1, row: 3, target: 29, actual: 6 },
  { code: "GA", name: "Goa", col: 1, row: 6, target: 15, actual: 8 },
  { code: "GJ", name: "Gujarat", col: 0, row: 4, target: 32, actual: 12 },
  { code: "HP", name: "Himachal Pradesh", col: 2, row: 1, target: 16, actual: 6 },
  { code: "HR", name: "Haryana", col: 1, row: 2, target: 21, actual: 8 },
  { code: "JH", name: "Jharkhand", col: 3, row: 4, target: 17, actual: 6 },
  { code: "JK", name: "Jammu & Kashmir", col: 2, row: 0, target: 13, actual: 8 },
  { code: "KA", name: "Karnataka", col: 2, row: 6, target: 23, actual: 7 },
  { code: "KL", name: "Kerala", col: 2, row: 7, target: 63, actual: 5 },
  { code: "LD", name: "Lakshadweep", col: -1, row: 7, target: 8, actual: 1 },
  { code: "MH", name: "Maharashtra", col: 1, row: 5, target: 82, actual: 18 },
  { code: "ML", name: "Meghalaya", col: 5.5, row: 4, target: 2, actual: 3 },
  { code: "MN", name: "Manipur", col: 6, row: 4, target: 7, actual: 4 },
  { code: "MP", name: "Madhya Pradesh", col: 1, row: 4, target: 28, actual: 7 },
  { code: "MZ", name: "Mizoram", col: 6, row: 5, target: 7, actual: 4 },
  { code: "NL", name: "Nagaland", col: 6, row: 3, target: 4, actual: 3 },
  { code: "OD", name: "Odisha", col: 3, row: 5, target: 19, actual: 5 },
  { code: "PB", name: "Punjab", col: 1, row: 1, target: 18, actual: 8 },
  { code: "PY", name: "Puducherry", col: 3, row: 7.5, target: 8, actual: 4 },
  { code: "RJ", name: "Rajasthan", col: 0, row: 3, target: 39, actual: 6 },
  { code: "SK", name: "Sikkim", col: 7, row: 1, target: 8, actual: 4 },
  { code: "TN", name: "Tamil Nadu", col: 3, row: 7, target: 44, actual: 4 },
  { code: "TR", name: "Tripura", col: 5, row: 4, target: 2, actual: 5 },
  { code: "TS", name: "Telangana", col: 2, row: 5, target: 26, actual: 5 },
  { code: "UK", name: "Uttarakhand", col: 2, row: 2, target: 14, actual: 7 },
  { code: "UP", name: "Uttar Pradesh", col: 2, row: 3, target: 63, actual: 12 },
  { code: "WB", name: "West Bengal", col: 4, row: 4, target: 36, actual: 12 },
]

