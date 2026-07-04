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
      'Airport', 'Shopping Mall', 'Data Center', 'Tech Startup Office', 'TV News Studio',
      'Luxury Yacht', 'Music Festival', 'Amusement Park', 'Formula 1 Pit', 'Football Stadium',
      'Basketball Arena', 'Cruise Terminal', 'Research Laboratory', 'Nuclear Power Plant',
      'Film Set', 'Fashion Show', 'Convention Center', 'Warehouse', 'Prison',
      'Fire Station', 'Courthouse', 'Museum', 'Aquarium', 'Zoo', 'Stock Exchange',
      'Airport Lounge', 'Call Center', 'Construction Site'
    ]
  },
  {
    id: 'historical',
    name: 'Historical pack',
    words: [
      'Ancient Egypt', 'Roman Senate', 'Medieval Castle', 'Viking Village', 'Samurai Dojo',
      'Mughal Palace', 'Wild West Town', 'French Revolution', 'Greek Temple', 'Mayan Pyramid',
      'Renaissance Workshop', 'Royal Court', 'Gladiator Arena', 'Crusader Camp', 'Spartan Barracks',
      'Colonial Port', 'Silk Road Caravan', 'Stone Age Tribe', 'Pharaoh\'s Tomb', 'Forbidden City',
      'Napoleonic Battlefield', 'Victorian Mansion', 'Pirate Cove', 'Aztec Temple', 'Byzantine Palace',
      'Inca Fortress', 'Medieval Marketplace', 'Royal Throne Room'
    ]
  },
  {
    id: 'horror',
    name: 'Horror pack',
    words: [
      'Haunted Mansion', 'Abandoned Hospital', 'Graveyard', 'Cursed Church', 'Haunted Hotel',
      'Dark Forest', 'Abandoned School', 'Old Prison', 'Haunted Carnival', 'Creepy Doll Factory',
      'Secret Basement', 'Ancient Cemetery', 'Ghost Ship', 'Abandoned Mine', 'Cursed Castle',
      'Vampire Mansion', 'Zombie Shelter', 'Witch Hut', 'Underground Tunnel', 'Haunted Asylum',
      'Monster Laboratory', 'Foggy Swamp', 'Ritual Temple', 'Possessed Library', 'Haunted Theater',
      'Old Lighthouse', 'Abandoned Village', 'Crypt'
    ]
  },
  {
    id: 'gaming',
    name: 'Gaming pack',
    words: [
      'Esports Arena', 'LAN Party', 'Streaming Room', 'Gaming Cafe', 'Game Development Studio',
      'VR Arcade', 'Speedrun Event', 'Minecraft Server', 'Roblox Studio', 'Fortnite Island',
      'CS Tournament', 'Valorant Arena', 'League Championship', 'Dota Tournament', 'Racing Simulator',
      'Indie Studio', 'Console Store', 'Retro Arcade', 'Gaming Convention', 'Discord Server',
      'Twitch Studio', 'YouTube Gaming Room', 'QA Testing Lab', 'Pixel Art Studio', 'Motion Capture Studio',
      'Game Awards', 'Developer Office', 'Beta Testing Room'
    ]
  },
  {
    id: 'vacations',
    name: 'Vacations pack',
    words: [
      'Luxury Resort', 'Beach', 'Water Park', 'Mountain Cabin', 'Camping Site',
      'Safari Park', 'Island Resort', 'Ski Resort', 'Desert Camp', 'Cruise Ship',
      'Lighthouse', 'National Park', 'Rainforest Lodge', 'Volcano Trail', 'Hot Spring',
      'Scuba Diving Center', 'Surf Beach', 'Fishing Dock', 'Cliff Viewpoint', 'Jungle Camp',
      'Snow Village', 'Wine Vineyard', 'Countryside Farm', 'River Rafting Camp', 'Glamping Resort',
      'Beach Club', 'Holiday Villa', 'Tourist Information Center'
    ]
  },
  {
    id: 'scifi',
    name: 'Sci-Fi pack',
    words: [
      'Space Station', 'Moon Base', 'Mars Colony', 'Alien Spaceship', 'Time Machine Lab',
      'Robot Factory', 'Cyberpunk City', 'Orbital Research Lab', 'Asteroid Mine', 'Galactic Senate',
      'Space Academy', 'Cryogenic Chamber', 'Terraforming Facility', 'Quantum Laboratory', 'AI Core',
      'Drone Factory', 'Deep Space Observatory', 'Satellite Control Room', 'Wormhole Gate', 'Space Prison',
      'Interstellar Cruiser', 'Alien Marketplace', 'Hologram Arena', 'Fusion Reactor', 'Virtual Reality Hub',
      'Space Elevator', 'Planetary Outpost', 'Nano Technology Lab'
    ]
  },
  {
    id: 'indian',
    name: 'Indian pack',
    words: [
      'Red Fort', 'India Gate', 'Gateway of India', 'Taj Mahal', 'Qutub Minar',
      'Charminar', 'Golden Temple', 'Lotus Temple', 'Mysore Palace', 'Hawa Mahal',
      'Howrah Bridge', 'Marine Drive', 'Dal Lake', 'Konark Sun Temple', 'Ajanta Caves',
      'Ellora Caves', 'Sundarbans', 'Rann of Kutch', 'Jim Corbett National Park', 'Kedarnath Temple',
      'Vaishno Devi', 'Jagannath Temple', 'Meenakshi Temple', 'Bandra-Worli Sea Link', 'Statue of Unity',
      'Siachen Glacier', 'Parliament House', 'Rashtrapati Bhavan'
    ]
  },
  {
    id: 'cities',
    name: 'Famous Cities pack',
    words: [
      'New York', 'London', 'Paris', 'Tokyo', 'Dubai',
      'Singapore', 'Mumbai', 'Delhi', 'Sydney', 'Rome',
      'Berlin', 'Moscow', 'Los Angeles', 'Las Vegas', 'Seoul',
      'Bangkok', 'Hong Kong', 'Barcelona', 'Toronto', 'Istanbul',
      'Amsterdam', 'Venice', 'Prague', 'Rio de Janeiro', 'Cape Town',
      'Cairo', 'Athens', 'San Francisco'
    ]
  },
  {
    id: 'bollywood',
    name: 'Bollywood pack',
    words: [
      'Shah Rukh Khan', 'Salman Khan', 'Aamir Khan', 'Akshay Kumar', 'Ajay Devgn',
      'Hrithik Roshan', 'Ranbir Kapoor', 'Ranveer Singh', 'Kartik Aaryan', 'Varun Dhawan',
      'Amitabh Bachchan', 'Sunny Deol', 'Rajinikanth', 'Allu Arjun', 'Prabhas',
      'Yash', 'Deepika Padukone', 'Alia Bhatt', 'Katrina Kaif', 'Kiara Advani',
      'Kriti Sanon', 'Shraddha Kapoor', 'Kareena Kapoor', 'Priyanka Chopra', 'Madhuri Dixit',
      'Kajol', 'Sridevi', 'Rekha'
    ]
  },
  {
    id: 'landmarks',
    name: 'World Landmarks pack',
    words: [
      'Eiffel Tower', 'Statue of Liberty', 'Great Wall of China', 'Big Ben', 'Colosseum',
      'Sydney Opera House', 'Burj Khalifa', 'Christ the Redeemer', 'Mount Everest', 'Stonehenge',
      'Leaning Tower of Pisa', 'Machu Picchu', 'Mount Fuji', 'Niagara Falls', 'Grand Canyon',
      'Petra', 'Angkor Wat', 'Santorini', 'Taj Mahal', 'Golden Gate Bridge',
      'Mount Kilimanjaro', 'Forbidden City', 'Mount Rushmore', 'Acropolis', 'Sagrada Familia',
      'Buckingham Palace', 'Neuschwanstein Castle', 'Versailles Palace'
    ]
  },
  {
    id: 'sports',
    name: 'Sports pack',
    words: [
      'Cricket Stadium', 'Football Stadium', 'Tennis Court', 'Basketball Arena', 'Olympic Village',
      'Formula 1 Circuit', 'Boxing Ring', 'Golf Course', 'Swimming Pool', 'Ice Hockey Arena',
      'Baseball Stadium', 'Badminton Hall', 'Kabaddi Arena', 'Wrestling Arena', 'Chess Tournament',
      'Esports Arena', 'Archery Range', 'Shooting Range', 'Skate Park', 'Volleyball Court',
      'Table Tennis Hall', 'Marathon Route', 'Cycling Track', 'Gymnastics Arena', 'Rugby Stadium',
      'Surf Competition', 'Ski Resort', 'Horse Racing Track'
    ]
  },
  {
    id: 'food',
    name: 'Food pack',
    words: [
      'Pizza', 'Burger', 'Pasta', 'Biryani', 'Butter Chicken',
      'Paneer Tikka', 'Masala Dosa', 'Idli', 'Sushi', 'Ramen',
      'Tacos', 'Burrito', 'Noodles', 'Fried Rice', 'Ice Cream',
      'Chocolate', 'Coffee', 'Tea', 'Momos', 'Pani Puri',
      'Vada Pav', 'Pav Bhaji', 'Samosa', 'Jalebi', 'Rasgulla',
      'Gulab Jamun', 'Donut', 'Croissant'
    ]
  },
  {
    id: 'company',
    name: 'Famous Company pack',
    words: [
      'Google', 'Apple', 'Microsoft', 'Amazon', 'Meta',
      'Netflix', 'Tesla', 'NVIDIA', 'OpenAI', 'Samsung',
      'Sony', 'Intel', 'AMD', 'Adobe', 'Spotify',
      'Uber', 'Airbnb', 'SpaceX', 'Oracle', 'IBM',
      'Tata', 'Reliance', 'Infosys', 'Wipro', 'Flipkart',
      'Paytm', 'Swiggy', 'Zomato'
    ]
  },
  {
    id: 'music',
    name: 'Music pack',
    words: [
      'Taylor Swift', 'Ed Sheeran', 'Drake', 'The Weeknd', 'Eminem',
      'Bruno Mars', 'Adele', 'Billie Eilish', 'Justin Bieber', 'BTS',
      'BLACKPINK', 'Arijit Singh', 'Shreya Ghoshal', 'A. R. Rahman', 'Atif Aslam',
      'Sonu Nigam', 'Neha Kakkar', 'Lata Mangeshkar', 'Kishore Kumar', 'Mohit Chauhan',
      'KK', 'Diljit Dosanjh', 'Yo Yo Honey Singh', 'Badshah', 'Shankar Mahadevan',
      'Lucky Ali', 'Alan Walker', 'Imagine Dragons'
    ]
  },
  {
    id: 'professions',
    name: 'Professions Pack',
    words: [
      'Doctor', 'Police Officer', 'Firefighter', 'Teacher', 'Lawyer', 'Judge', 'Chef',
      'Pilot', 'Flight Attendant', 'Farmer', 'Scientist', 'Engineer', 'Architect',
      'Mechanic', 'Electrician', 'Plumber', 'Photographer', 'Journalist', 'YouTuber',
      'Streamer', 'Software Developer', 'Soldier', 'Detective', 'Astronaut',
      'Fashion Designer', 'Musician', 'Actor', 'Veterinarian'
    ]
  },
  {
    id: 'internet',
    name: 'Internet culture pack',
    words: [
      'Discord Server', 'Reddit', 'Instagram', 'YouTube', 'TikTok', 'Netflix', 'Spotify',
      'Steam', 'Epic Games', 'GitHub', 'Wikipedia', 'Google', 'Amazon', 'ChatGPT', 'Claude',
      'Gemini', 'Twitch', 'WhatsApp', 'Telegram', 'Snapchat', 'X (Twitter)', 'Facebook',
      'Pinterest', 'LinkedIn', 'Stack Overflow', 'Canva', 'Notion', 'Figma'
    ]
  },
  {
    id: 'restricted',
    name: 'restricted pack',
    words: [
      'Area 51', 'Secret Bunker', 'Underground Vault', 'Nuclear Shelter', 'War Room',
      'CIA Headquarters', 'MI6 Headquarters', 'Research Facility', 'Hidden Laboratory',
      'Abandoned Mine', 'Underground Metro', 'Missile Silo', 'Treasure Vault', 'Royal Treasury',
      'Secret Tunnel', 'Prison Cell', 'Interrogation Room', 'Safe House', 'Military Command Center',
      'Control Room', 'Observation Deck', 'Server Room', 'Archive Room', 'Evidence Locker',
      'Emergency Operations Center', 'Escape Tunnel', 'Power Grid Control Center', 'Satellite Control Room'
    ]
  }
];
