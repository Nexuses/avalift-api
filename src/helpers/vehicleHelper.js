
module.exports = {
    validatePlate: async (plate, number_of_digits) => {
        //clean and upper case the input
        plate = plate.trim().toUpperCase();
        //basic length check A00001 to ZZ99999
        const alphaPart = plate.match(/[A-Z]+/g)?.join('') || '';
        const digitPart = plate.match(/\d+/g)?.join('') || '';

        //console.log('alphaPart', alphaPart, ' and digitPart', digitPart);

        //validate letters
        if (!/^[A-Z]+$/.test(alphaPart) || alphaPart.length < 1 || alphaPart.length > 2) {
            throw new Error(`Format must match A${"0".repeat(number_of_digits)}`);
        }

        //validate digits
        if (!/^\d+$/.test(digitPart) || digitPart.length < 0 || digitPart.length > number_of_digits) {
            throw new Error(`Format must match A${"0".repeat(number_of_digits)}`);
        }
    }
};