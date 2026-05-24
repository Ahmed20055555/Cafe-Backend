module.exports = function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join session room for customer-specific updates
    socket.on('join:session', (sessionId) => {
      socket.join(`session:${sessionId}`);
      console.log(`📱 Socket ${socket.id} joined session: ${sessionId}`);
    });

    // Join kitchen room
    socket.on('join:kitchen', () => {
      socket.join('kitchen');
      console.log(` Socket ${socket.id} joined kitchen`);
    });

    // Join staff room
    socket.on('join:staff', () => {
      socket.join('staff');
      console.log(`👨‍💼 Socket ${socket.id} joined staff`);
    });

    // Join admin room
    socket.on('join:admin', () => {
      socket.join('admin');
      console.log(`📊 Socket ${socket.id} joined admin`);
    });

    // Handle order status update from kitchen
    socket.on('order:updateStatus', (data) => {
      io.emit('order:statusUpdate', data);
    });

    // Handle item status update from kitchen
    socket.on('order:updateItemStatus', (data) => {
      io.emit('order:itemUpdate', data);
    });

    // Handle bill request from customer
    socket.on('bill:request', (data) => {
      io.to('staff').emit('bill:requested', data);
    });

    // Handle table cleanup
    socket.on('table:cleanup', (data) => {
      io.emit('table:statusUpdate', data);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};
