const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');

// قراءة المتغيرات من ملف .env
dotenv.config();

const createAdmin = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error('❌ خطأ: MONGODB_URI غير موجود في ملف .env');
      process.exit(1);
    }

    console.log('⏳ جاري الاتصال بقاعدة بيانات MongoDB Atlas...');
    await mongoose.connect(mongoURI);
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');

    const email = 'admin@cafe.com';
    const password = 'admin123';

    // التحقق مما إذا كان المستخدم موجود مسبقاً
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log(`⚠️ المستخدم ${email} موجود بالفعل! جاري تحديث كلمة المرور والصلاحية لتأكيد الدخول...`);
      // تحديث البيانات وحفظها (سيتم تشفير الباسورد تلقائياً بفضل الـ pre-save hook في الموديل)
      existingUser.password = password;
      existingUser.role = 'admin';
      await existingUser.save();
      console.log('✅ تم تحديث بيانات الأدمن بنجاح.');
    } else {
      console.log('⏳ جاري إنشاء مستخدم أدمن جديد...');
      const adminUser = new User({
        name: 'Admin Manager',
        email: email,
        password: password,
        role: 'admin',
        isActive: true
      });
      await adminUser.save();
      console.log('✅ تم إنشاء الأدمن بنجاح!');
    }

    console.log('🎉 انتهت العملية. يمكنك الآن تسجيل الدخول.');
    process.exit(0);
  } catch (error) {
    console.error('❌ حدث خطأ:', error);
    process.exit(1);
  }
};

createAdmin();
