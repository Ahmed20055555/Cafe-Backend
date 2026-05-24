require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

const User = require('../models/User');
const Table = require('../models/Table');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Bill = require('../models/Bill');
const Session = require('../models/Session');
const connectDB = require('../config/db');

const seed = async () => {
  await connectDB();
  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}), Table.deleteMany({}),
    Category.deleteMany({}), MenuItem.deleteMany({}),
    Order.deleteMany({}), Bill.deleteMany({}), Session.deleteMany({})
  ]);

  // --- USERS ---
  console.log('👥 Creating users...');
  const users = await User.create([
    { name: 'Admin', email: 'admin@cafe.com', password: 'admin123', role: 'admin', phone: '+201000000000' },
    { name: 'Ahmed (Waiter)', email: 'ahmed@cafe.com', password: 'waiter123', role: 'waiter', phone: '+201111111111' },
    { name: 'Sara (Waiter)', email: 'sara@cafe.com', password: 'waiter123', role: 'waiter', phone: '+201222222222' },
    { name: 'Kitchen Staff', email: 'kitchen@cafe.com', password: 'kitchen123', role: 'kitchen', phone: '+201333333333' }
  ]);
  console.log(`   ✅ Created ${users.length} users`);

  // --- TABLES ---
  console.log('🪑 Creating tables...');
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const tables = [];
  const locations = ['indoor', 'indoor', 'indoor', 'indoor', 'outdoor', 'outdoor', 'terrace', 'terrace', 'vip', 'vip'];
  for (let i = 1; i <= 10; i++) {
    const qrUrl = `${clientUrl}/menu?table=${i}`;
    const qrCode = await QRCode.toDataURL(qrUrl, { width: 400, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } });
    tables.push({
      number: i, capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
      location: locations[i - 1],
      assignedWaiter: i <= 5 ? users[1]._id : users[2]._id,
      qrCode
    });
  }
  await Table.create(tables);
  console.log(`   ✅ Created ${tables.length} tables with QR codes`);

  // --- CATEGORIES ---
  console.log('📂 Creating categories...');
  const categories = await Category.create([
    { name: 'Hot Drinks', nameAr: 'مشروبات ساخنة', icon: '☕', sortOrder: 1 },
    { name: 'Cold Drinks', nameAr: 'مشروبات باردة', icon: '🧊', sortOrder: 2 },
    { name: 'Breakfast', nameAr: 'فطور', icon: '🥐', sortOrder: 3 },
    { name: 'Sandwiches', nameAr: 'ساندويتشات', icon: '🥪', sortOrder: 4 },
    { name: 'Main Course', nameAr: 'أطباق رئيسية', icon: '🍽️', sortOrder: 5 },
    { name: 'Pasta', nameAr: 'باستا', icon: '🍝', sortOrder: 6 },
    { name: 'Salads', nameAr: 'سلطات', icon: '🥗', sortOrder: 7 },
    { name: 'Desserts', nameAr: 'حلويات', icon: '🍰', sortOrder: 8 },
    { name: 'Smoothies', nameAr: 'سموذي', icon: '🥤', sortOrder: 9 }
  ]);
  console.log(`   ✅ Created ${categories.length} categories`);

  // --- MENU ITEMS ---
  console.log('🍕 Creating menu items...');
  const catMap = {};
  categories.forEach(c => { catMap[c.name] = c._id; });

  const menuItems = [
    // Hot Drinks
    { category: catMap['Hot Drinks'], name: 'Espresso', nameAr: 'اسبريسو', price: 35, preparationTime: 5, isPopular: true, allergens: [], addOns: [{ name: 'Extra Shot', nameAr: 'شوت إضافي', price: 10 }, { name: 'Oat Milk', nameAr: 'حليب شوفان', price: 15 }], description: 'Rich and bold single espresso shot' },
    { category: catMap['Hot Drinks'], name: 'Cappuccino', nameAr: 'كابتشينو', price: 50, preparationTime: 7, isPopular: true, allergens: ['dairy'], addOns: [{ name: 'Extra Shot', price: 10 }, { name: 'Vanilla Syrup', price: 10 }, { name: 'Caramel Drizzle', price: 10 }], description: 'Creamy cappuccino with silky foam' },
    { category: catMap['Hot Drinks'], name: 'Latte', nameAr: 'لاتيه', price: 55, preparationTime: 7, isPopular: true, allergens: ['dairy'], addOns: [{ name: 'Hazelnut Syrup', price: 10 }, { name: 'Extra Shot', price: 10 }], description: 'Smooth latte with steamed milk' },
    { category: catMap['Hot Drinks'], name: 'Mocha', nameAr: 'موكا', price: 60, preparationTime: 8, allergens: ['dairy'], addOns: [{ name: 'Whipped Cream', price: 10 }], description: 'Chocolate lovers espresso drink' },
    { category: catMap['Hot Drinks'], name: 'Turkish Coffee', nameAr: 'قهوة تركي', price: 30, preparationTime: 8, allergens: [], description: 'Traditional Turkish coffee' },
    { category: catMap['Hot Drinks'], name: 'Hot Chocolate', nameAr: 'شوكولاتة ساخنة', price: 55, preparationTime: 7, allergens: ['dairy'], addOns: [{ name: 'Marshmallows', price: 10 }], description: 'Rich Belgian hot chocolate' },

    // Cold Drinks
    { category: catMap['Cold Drinks'], name: 'Iced Americano', nameAr: 'أمريكانو مثلج', price: 45, preparationTime: 5, isPopular: true, allergens: [], description: 'Bold espresso over ice' },
    { category: catMap['Cold Drinks'], name: 'Iced Latte', nameAr: 'لاتيه مثلج', price: 55, preparationTime: 5, allergens: ['dairy'], addOns: [{ name: 'Caramel', price: 10 }, { name: 'Vanilla', price: 10 }], description: 'Refreshing iced latte' },
    { category: catMap['Cold Drinks'], name: 'Fresh Orange Juice', nameAr: 'عصير برتقال', price: 40, preparationTime: 5, allergens: [], description: 'Freshly squeezed oranges' },
    { category: catMap['Cold Drinks'], name: 'Lemonade', nameAr: 'ليموناضة', price: 35, preparationTime: 5, allergens: [], addOns: [{ name: 'Mint', price: 5 }], description: 'Fresh homemade lemonade' },

    // Breakfast
    { category: catMap['Breakfast'], name: 'Classic Eggs Benedict', nameAr: 'بيض بينيديكت', price: 85, preparationTime: 15, isPopular: true, allergens: ['eggs', 'gluten', 'dairy'], description: 'Poached eggs with hollandaise on English muffin' },
    { category: catMap['Breakfast'], name: 'Avocado Toast', nameAr: 'توست أفوكادو', price: 75, preparationTime: 10, isPopular: true, allergens: ['gluten', 'sesame'], addOns: [{ name: 'Poached Egg', price: 15 }, { name: 'Smoked Salmon', price: 30 }], description: 'Smashed avocado on sourdough' },
    { category: catMap['Breakfast'], name: 'Pancake Stack', nameAr: 'بان كيك', price: 70, preparationTime: 12, allergens: ['gluten', 'dairy', 'eggs'], addOns: [{ name: 'Nutella', price: 15 }, { name: 'Mixed Berries', price: 20 }], description: 'Fluffy pancakes with maple syrup' },
    { category: catMap['Breakfast'], name: 'Full English', nameAr: 'فطور إنجليزي', price: 110, preparationTime: 20, allergens: ['eggs', 'gluten'], description: 'Eggs, sausage, bacon, beans, toast, mushrooms' },

    // Sandwiches
    { category: catMap['Sandwiches'], name: 'Club Sandwich', nameAr: 'كلوب ساندويتش', price: 85, preparationTime: 12, isPopular: true, allergens: ['gluten', 'eggs'], description: 'Triple-decker chicken club with fries' },
    { category: catMap['Sandwiches'], name: 'Grilled Cheese', nameAr: 'جبن مشوي', price: 65, preparationTime: 10, allergens: ['gluten', 'dairy'], addOns: [{ name: 'Tomato Soup', price: 25 }], description: 'Melted cheddar on sourdough' },
    { category: catMap['Sandwiches'], name: 'Chicken Wrap', nameAr: 'راب دجاج', price: 75, preparationTime: 10, allergens: ['gluten'], description: 'Grilled chicken with veggies in tortilla' },

    // Main Course
    { category: catMap['Main Course'], name: 'Grilled Chicken', nameAr: 'دجاج مشوي', price: 130, preparationTime: 25, isPopular: true, allergens: [], addOns: [{ name: 'Extra Sauce', price: 10 }, { name: 'Side Salad', price: 20 }], description: 'Herb-marinated grilled chicken breast' },
    { category: catMap['Main Course'], name: 'Beef Burger', nameAr: 'برجر لحم', price: 110, preparationTime: 18, isPopular: true, allergens: ['gluten', 'dairy', 'sesame'], addOns: [{ name: 'Extra Patty', price: 40 }, { name: 'Bacon', price: 20 }], description: 'Angus beef with cheddar and special sauce' },
    { category: catMap['Main Course'], name: 'Salmon Fillet', nameAr: 'فيليه سلمون', price: 165, preparationTime: 22, allergens: ['fish'], description: 'Pan-seared salmon with lemon butter sauce' },
    { category: catMap['Main Course'], name: 'Chicken Tenders', nameAr: 'تندر دجاج', price: 90, preparationTime: 15, allergens: ['gluten'], description: 'Crispy chicken tenders with honey mustard' },

    // Pasta
    { category: catMap['Pasta'], name: 'Spaghetti Bolognese', nameAr: 'سباغيتي بولونيز', price: 95, preparationTime: 18, allergens: ['gluten', 'dairy'], description: 'Classic meat sauce spaghetti' },
    { category: catMap['Pasta'], name: 'Fettuccine Alfredo', nameAr: 'فيتوتشيني ألفريدو', price: 100, preparationTime: 18, isPopular: true, allergens: ['gluten', 'dairy'], addOns: [{ name: 'Grilled Chicken', price: 30 }, { name: 'Shrimp', price: 40 }], description: 'Creamy parmesan alfredo sauce' },
    { category: catMap['Pasta'], name: 'Penne Arrabiata', nameAr: 'بيني أرابياتا', price: 85, preparationTime: 15, allergens: ['gluten'], description: 'Spicy tomato sauce pasta' },

    // Salads
    { category: catMap['Salads'], name: 'Caesar Salad', nameAr: 'سلطة سيزر', price: 75, preparationTime: 8, allergens: ['dairy', 'gluten', 'eggs', 'fish'], addOns: [{ name: 'Grilled Chicken', price: 30 }], description: 'Romaine, croutons, parmesan, caesar dressing' },
    { category: catMap['Salads'], name: 'Greek Salad', nameAr: 'سلطة يونانية', price: 65, preparationTime: 8, allergens: ['dairy'], description: 'Tomato, cucumber, olives, feta cheese' },

    // Desserts
    { category: catMap['Desserts'], name: 'Chocolate Lava Cake', nameAr: 'كيك شوكولاتة', price: 70, preparationTime: 15, isPopular: true, allergens: ['gluten', 'dairy', 'eggs'], description: 'Warm molten chocolate cake with ice cream' },
    { category: catMap['Desserts'], name: 'Crème Brûlée', nameAr: 'كريم بروليه', price: 65, preparationTime: 10, allergens: ['dairy', 'eggs'], description: 'Classic French vanilla custard' },
    { category: catMap['Desserts'], name: 'Cheesecake', nameAr: 'تشيز كيك', price: 70, preparationTime: 5, allergens: ['gluten', 'dairy', 'eggs'], addOns: [{ name: 'Berry Compote', price: 15 }], description: 'New York style cheesecake' },

    // Smoothies
    { category: catMap['Smoothies'], name: 'Mango Smoothie', nameAr: 'سموذي مانجو', price: 55, preparationTime: 5, allergens: ['dairy'], description: 'Fresh mango blended with yogurt' },
    { category: catMap['Smoothies'], name: 'Mixed Berry Smoothie', nameAr: 'سموذي توت', price: 60, preparationTime: 5, isPopular: true, allergens: ['dairy'], description: 'Strawberry, blueberry, raspberry blend' },
    { category: catMap['Smoothies'], name: 'Green Detox', nameAr: 'سموذي أخضر', price: 55, preparationTime: 5, allergens: [], description: 'Spinach, apple, ginger, lemon' }
  ];

  await MenuItem.create(menuItems);
  console.log(`   ✅ Created ${menuItems.length} menu items`);

  // --- MOCK ORDERS & BILLS FOR DASHBOARD ---
  console.log('🧾 Creating mock orders and bills...');
  const items = await MenuItem.find().limit(3);

  const mockSession = await Session.create({
    tableNumber: 2,
    token: 'mock-token-123',
    status: 'closed',
    waiter: users[1]._id
  });

  const orderItems = [
    { menuItem: items[0]._id, quantity: 2, price: items[0].price, name: items[0].nameAr, status: 'ready' },
    { menuItem: items[1]._id, quantity: 1, price: items[1].price, name: items[1].nameAr, status: 'ready' }
  ];

  const total = items[0].price * 2 + items[1].price;

  const mockOrder = await Order.create({
    session: mockSession._id,
    type: 'dine-in',
    items: orderItems,
    subtotal: total,
    total: total + (total * 0.15),
    status: 'ready'
  });

  await Bill.create({
    session: mockSession._id,
    tableNumber: 2,
    orders: [mockOrder._id],
    subtotal: total,
    taxAmount: total * 0.15,
    total: total + (total * 0.15),
    status: 'paid',
    paymentMethod: 'card',
    paidAt: new Date()
  });

  // Mock a pending order for KDS
  await Order.create({
    type: 'takeaway',
    items: [
      { menuItem: items[2]._id, quantity: 3, price: items[2].price, name: items[2].nameAr, status: 'pending' }
    ],
    subtotal: items[2].price * 3,
    total: (items[2].price * 3) * 1.15,
    status: 'pending'
  });

  // Update item popular counts
  await MenuItem.updateOne({ _id: items[0]._id }, { $set: { totalOrdered: 42 } });
  await MenuItem.updateOne({ _id: items[1]._id }, { $set: { totalOrdered: 38 } });
  await MenuItem.updateOne({ _id: items[2]._id }, { $set: { totalOrdered: 24 } });

  console.log(`   ✅ Created mock orders for dashboard`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin:   admin@cafe.com / admin123');
  console.log('   Waiter:  ahmed@cafe.com / waiter123');
  console.log('   Kitchen: kitchen@cafe.com / kitchen123\n');

  process.exit(0);
};

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
