import { WordPack } from './types';

export const BUILT_IN_PACKS: WordPack[] = [
  {
    id: 'classic',
    name: 'Classic Spyfall',
    words: [
      'Airplane', 'Bank', 'Beach', 'Cathedral', 'Circus Tent', 'Corporate Party', 
      'Crusader Army', 'Casino', 'Day Spa', 'Embassy', 'Hospital', 'Hotel', 
      'Military Base', 'Movie Studio', 'Ocean Liner', 'Passenger Train', 
      'Pirate Ship', 'Polar Station', 'Police Station', 'Restaurant', 
      'School', 'Service station', 'Space station', 'Submarine', 
      'Supermarket', 'Theater', 'University', 'World War II Squad'
    ]
  },
  {
    id: 'standard',
    name: 'Standard',
    words: [
      'Art Museum', 'Library', 'Temple', 'Amusement Park', 'Train Station', 
      'Subway', 'Zoo', 'Aquarium', 'Post Office', 'Shopping Mall', 'Skyscraper', 
      'Golf Course', 'Castle', 'Greenhouse', 'Airport Terminal', 'Gym', 
      'Recording Studio', 'Cruise Ship', 'Water Park', 'Construction Site'
    ]
  }
];
