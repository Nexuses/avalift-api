const isOverlapping = (existingPickup, existingDuration, newPickup, newDuration) => {
    if (!existingPickup || !newPickup) {
        console.error("Invalid date values detected:", { existingPickup, newPickup });
        return false;
    }

    if (isNaN(existingDuration) || isNaN(newDuration)) {
        console.error("Invalid duration values detected:", { existingDuration, newDuration });
        return false;
    }

    try {
        const existingStart = new Date(existingPickup).getTime();
        const existingEnd = existingStart + (existingDuration * 60000);
        const newStart = new Date(newPickup).getTime();
        const newEnd = newStart + (newDuration * 60000);

        console.log(`
          Checking Overlap:
          Existing Ride: ${new Date(existingStart).toISOString()} - ${new Date(existingEnd).toISOString()}
          New Ride: ${new Date(newStart).toISOString()} - ${new Date(newEnd).toISOString()}
        `);

        return newStart < existingEnd && existingStart < newEnd;
    } catch (error) {
        console.error("Error in isOverlapping function:", error);
        return false;
    }
};

module.exports = { isOverlapping };
