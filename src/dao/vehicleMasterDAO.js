const ddbDocClient = require('./ddbClient');
const { QueryCommand, ScanCommand, PutCommand ,GetCommand, UpdateCommand,DeleteCommand} = require('@aws-sdk/lib-dynamodb');
const { addServerLog } = require('../services/serverLogsService');

module.exports = {
  getModelsByBrand: async (brand) => {
    const params = {
      TableName: 'VehicleMaster',
      KeyConditionExpression: 'brand = :brand',
      ExpressionAttributeValues: {
        ':brand': brand,
      },
    };

    try {
      const result = await ddbDocClient.send(new QueryCommand(params));
      console.log('Query Result:', result.Items);
      return result.Items.map((item) => item.model);
    } catch (error) {
      console.log('Error fetching models for brand:', error);
      await addServerLog({
        log_level: 'ERROR',
        service_name: 'getModelsByBrand',
        error_message: `Error fetching models for brand "${brand}": ${error.message}`,
      });
 
      throw new Error(`Error fetching models for brand "${brand}": ${error.message}`);
      
    }
  },
  

  getAllBrands : async () => {
    const params = {
      TableName: "VehicleMaster",
      ProjectionExpression: "brand, brandImage",
    };
  
    try {
      const result = await ddbDocClient.send(new ScanCommand(params));
      console.log("Scan Result:", result.Items);
  
      // Create a Map to store unique brands with their latest brand image
      const brandMap = new Map();
  
      result.Items.forEach((item) => {
        const brandName = item.brand.trim(); // Remove unwanted spaces
  
        // Store the latest image or keep an existing one if null
        if (!brandMap.has(brandName) || (item.brandImage && brandMap.get(brandName) === null)) {
          brandMap.set(brandName, item.brandImage || null);
        }
      });
  
      // Convert map to an array of objects
      const uniqueBrands = Array.from(brandMap, ([brand, brandImage]) => ({
        brand,
        brandImage,
      }));
  
      return uniqueBrands;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllBrands",
        error_message: `Error fetching all brands: ${error.message}`,
      });
      console.error("DynamoDB Scan Error:", error);
      throw new Error(`Error fetching all brands: ${error.message}`);
    }
  },
  

  // Add a new model to an existing brand (Update the models array)
  addModelToBrand: async (brand, newModel, brand_image) => {
    const params = {
      TableName: "VehicleMaster",
      Item: {
        brand, // Partition Key
        model: newModel, // Sort Key
        brandImage: brand_image,
        lower_brand: brand.toLowerCase(),
        lower_model: newModel.toLowerCase()
      },
    };

    try {
      // Check if the model already exists for the brand
      // const getParams = {
      //   TableName: "VehicleMaster",
      //   Key: { brand, model: newModel},
      // };
      // const existingModel = await ddbDocClient.send(new GetCommand(getParams));
      // if (existingModel.Item) {
      //   throw new Error(`Model ${newModel} already exists for brand ${brand}.`);
      // }

      // Add the new model
      const command = new PutCommand(params);
      await ddbDocClient.send(command);
      console.log(`Model ${newModel} added to brand ${brand}.`);
      return { brand, model: newModel, brandImage: brand_image};
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "addModelToBrand",
        error_message: `Error adding model "${newModel}" to brand "${brand}": ${error.message}`,
      });
      console.error("DynamoDB Put Error:", error);
      throw new Error(`Error adding model "${newModel}" to brand "${brand}": ${error.message}`);
    }
  },



  // // Add a new model to an existing brand (Update the models array)
  // addModelToBrand: async (brand, newModel, brand_image) => {
  //   const params = {
  //     TableName: "VehicleMaster",
  //     Item: {
  //       brand, // Partition Key
  //       model: newModel, // Sort Key
  //       brandImage: brand_image
  //     },
  //     ConditionExpression: "attribute_not_exists(brand) AND attribute_not_exists(model)", 
  //   };

  //   try {
  //     // // Check if the model already exists for the brand
  //     // const getParams = {
  //     //   TableName: "VehicleMaster",
  //     //   Key: { brand, model: newModel},
  //     // };
  //     // const existingModel = await ddbDocClient.send(new GetCommand(getParams));
  //     // if (existingModel.Item) {
  //     //   throw new Error(`Model ${newModel} already exists for brand ${brand}.`);
  //     // }

  //     // Add the new model
  //     const command = new PutCommand(params);
  //     await ddbDocClient.send(command);
  //     console.log(`Model ${newModel} added to brand ${brand}.`);
  //     return { brand, model: newModel, brandImage: brand_image};
  //   } catch (error) {
  //     await addServerLog({
  //       log_level: "ERROR",
  //       service_name: "addModelToBrand",
  //       error_message: `Error adding model "${newModel}" to brand "${brand}": ${error.message}`,
  //     });
  //     console.error("DynamoDB Put Error:", error);
  //     throw new Error(`Error adding model "${newModel}" to brand "${brand}": ${error.message}`);
  //   }
  // },
  
  // Method to save brand to the VehicleMaster table
  saveBrand: async (brand_name,brandImagePath) => {
    const params = {
      TableName:'VehicleMaster',
      Item: {
        brand: brand_name,       // Partition key
        model:"brand_details",       // Sort key (You can change this logic if needed)
       //...(brandName ? { model: "default" } : {}),
        brandImage: brandImagePath,  // Additional field for the brand image
        lower_brand: brand_name.toLowerCase(),
        lower_model:"brand_details"
      }
    };

    try {
      //await  ddbDocClient.put(params).promise();
      const command = new PutCommand(params);  // Use PutCommand for v3 SDK
      await ddbDocClient.send(command); 
       // Send the command using ddbDocClient
      console.log("brandname",brand_name);
      return params.Item; // Return the saved item
    
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "saveBrand",
        error_message: `Error saving brand: ${error.message}`,
      })
      console.error('Error saving brand:', error);
      throw new Error('Error saving brand');
    }
  },
  
  getBrandByName: async (brand_name) => {
    const params = {
      TableName: "VehicleMaster",
      KeyConditionExpression: "#brand = :brandName",
      ExpressionAttributeNames: {
        "#brand": "brand",
      },
      ExpressionAttributeValues: {
        ":brandName": brand_name.trim(), // Trim to avoid spacing issues
      },
    };
  
    try {
      const result = await ddbDocClient.send(new QueryCommand(params));
      return result.Items.length > 0 ? result.Items[0] : null; // Return brand if found
    } catch (error) {
      console.error("DynamoDB Query Error:", error);
      throw new Error(`Error checking brand existence: ${error.message}`);
    }
  },
  

  
// updateBrand: async (old_brand_name, new_brand_name) => {
//   try {
//     //  Query all items that match the old brand name
//     const queryParams = {
//       TableName: "VehicleMaster",
//       KeyConditionExpression: "#brand = :oldBrand",
//       ExpressionAttributeNames: {
//         "#brand": "brand",
//       },
//       ExpressionAttributeValues: {
//         ":oldBrand": old_brand_name,
//       },
//     };

//     const queryCommand = new QueryCommand(queryParams);
//     const { Items } = await ddbDocClient.send(queryCommand);

//     if (!Items || Items.length === 0) {
//       throw new Error(`No records found for brand: ${old_brand_name}`);
//     }

//     //  Insert new records with new brand name
//     for (const item of Items) {
//       const newItem = {
//         ...item,
//         brand: new_brand_name, // Update the brand field
//       };

//       const putParams = {
//         TableName: "VehicleMaster",
//         Item: newItem,
//       };

//       const putCommand = new PutCommand(putParams);
//       await ddbDocClient.send(putCommand);
//     }

//     // Delete old records
//     for (const item of Items) {
//       const deleteParams = {
//         TableName: "VehicleMaster",
//         Key: {
//           brand: item.brand,  // Partition Key (Old Brand)
//           model: item.model,  // Sort Key
//         },
//       };

//       const deleteCommand = new DeleteCommand(deleteParams);
//       await ddbDocClient.send(deleteCommand);
//     }

//     console.log(`Brand updated from "${old_brand_name}" to "${new_brand_name}" successfully.`);
//     return { success: true, message: "Brand updated successfully." };

//   } catch (error) {
//     console.error("Error updating brand:", error);
//     throw new Error(`Error updating brand: ${error.message}`);
//   }
// },

updateBrand: async (old_brand_name, new_brand_name, new_brand_image) => {
  try {
    console.log("old",old_brand_name);
    console.log("new",new_brand_name);
    console.log("image:",new_brand_image);
    // Query all items with the old brand name
    const queryParams = {
      TableName: "VehicleMaster",
      KeyConditionExpression: "#brand = :oldBrand",
      ExpressionAttributeNames: {
        "#brand": "brand",
      },
      ExpressionAttributeValues: {
        ":oldBrand": old_brand_name,
      },
    };

    const queryCommand = new QueryCommand(queryParams);
    const { Items } = await ddbDocClient.send(queryCommand);

    if (!Items || Items.length === 0) {
      //throw new Error(`No records found for brand: ${old_brand_name}`);
      return null;
    }

    console.log(`Found ${Items.length} items for brand: ${old_brand_name}`);

    // **Step 1: Delete Old Records First**
    for (const item of Items) {
      const deleteParams = {
        TableName: "VehicleMaster",
        Key: {
          brand: item.brand, // Old brand name
          model: item.model, // Sort key
        },
      };

      console.log(`Deleting old item: ${JSON.stringify(deleteParams.Key)}`);

      const deleteCommand = new DeleteCommand(deleteParams);
      await ddbDocClient.send(deleteCommand);
    }

    console.log(`Deleted old brand records for: ${old_brand_name}`);

    // **Step 2: Insert New Records with Updated Brand Name & Image**
    for (const item of Items) {
      const newItem = {
        ...item,
        brand: new_brand_name, // Update brand name
        brandImage: new_brand_image || null, // Overwrite brandImage (null if not provided)
      };

      console.log(`Inserting new item with updated brand image: ${JSON.stringify(newItem)}`);

      const putParams = {
        TableName: "VehicleMaster",
        Item: newItem,
      };

      const putCommand = new PutCommand(putParams);
      await ddbDocClient.send(putCommand);
    }

    console.log(`Inserted new brand records for: ${new_brand_name}`);

    return {
      new_brand_name,
      new_brand_image,
    };

  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateBrand",
      error_message: `Error updating brand: ${error.message}`,
    });
    console.error("Error updating brand:", error);
    throw  error;//`Error updating brand: ${error.message}`);
  }
},


 // Update Model for a brand in the VehicleMaster table
updateModelForBrand: async (brand, old_model, new_model) => {
  const deleteParams = {
    TableName: "VehicleMaster",
    Key: {
      brand,      // Partition Key (Brand)
      model: old_model  // Sort Key (Old Model)
    },
  };

  const insertParams = {
    TableName: "VehicleMaster",
    Item: {
      brand,      // Partition Key (Brand)
      model: new_model,  // Sort Key (New Model)
    },
  };

  try {
    // First, delete the old item
    const deleteCommand = new DeleteCommand(deleteParams);
    await ddbDocClient.send(deleteCommand);
    console.log(`Old model ${old_model} deleted for brand "${brand}".`);

    // Now, insert the new item with the updated model
    const putCommand = new PutCommand(insertParams);
    await ddbDocClient.send(putCommand);
    console.log(`Model for brand "${brand}" updated to "${new_model}".`);

    return { brand, old_model, new_model };  // Return updated data
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateModelForBrand",
      error_message: `Error updating model for brand "${brand}" to "${new_model}": ${error.message}`,
    });
    console.error("Error updating model:", error);
    throw new Error(`Error updating model for brand "${brand}" to "${new_model}": ${error.message}`);
  }
},

getAllBrandsAndModels : async () => {
  try {
    const params = {
      TableName:"VehicleMaster",
    };

    const command = new ScanCommand(params);
    const data = await ddbDocClient.send(command);

    return data.Items;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllBrandsAndModels",
      error_message: `Error fetching brands and models: ${error.message}`,
    });
    console.error("Error fetching brands and models:", error);
    throw error;
  }
},

getBrandImage:  async (make, model) => {
  try {
    const params = {
      TableName: "VehicleMaster", // Replace with your actual table name
      KeyConditionExpression: "brand = :brand AND #model = :model", // Ensure model is aliased correctly
      ExpressionAttributeNames: {
        "#model": "model", // Alias 'model' if it's a reserved word
      },
      ExpressionAttributeValues: {
        ":brand": make, // PK value
        ":model": model, // SK value
      },
      ProjectionExpression: "brandImage", // Fetch only brand_image field
    };

    console.log("Querying for brand:", make, "model:", model);
    
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items?.[0] || {};
    
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getBrandImage",
      error_message: `Error fetching brand image: ${error.message}`,
    });
    console.error("Error fetching brand image:", error);
    throw error;
  }
},

deleteModelFromBrand: async (brand, model) => {
  const params = {
    TableName: "VehicleMaster",
    Key: { brand, model },
  };

  try {
    // Check if item exists
    const getParams = {
      TableName: "VehicleMaster",
      Key: { brand, model },
    };
    const existingItem = await ddbDocClient.send(new GetCommand(getParams));
    if (!existingItem.Item) {
      throw new Error(`Model ${model} does not exist under brand ${brand}.`);
    }

    // Delete the model
    const deleteCommand = new DeleteCommand(params);
    await ddbDocClient.send(deleteCommand);

    console.log(`Model ${model} deleted from brand ${brand}.`);
    return { brand, model, brandImage: existingItem.Item.brandImage };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteModelFromBrand",
      error_message: `Error deleting model "${model}" from brand "${brand}": ${error.message}`,
    });
    console.error("DynamoDB Delete Error:", error);
    throw new Error(`Error deleting model "${model}" from brand "${brand}": ${error.message}`);
  }
},

deleteBrand: async (brand) => {
  try {
    // Step 1: Get all items (models + brand_details) under this brand
    const scanParams = {
      TableName: "VehicleMaster",
      KeyConditionExpression: "brand = :brand",
      ExpressionAttributeValues: {
        ":brand": brand,
      },
    };

    const data = await ddbDocClient.send(new QueryCommand(scanParams));

    if (!data.Items || data.Items.length === 0) {
      throw new Error(`No entries found for brand ${brand}.`);
    }

    // Step 2: Delete all items
    const deletePromises = data.Items.map(item => {
      const deleteParams = {
        TableName: "VehicleMaster",
        Key: { brand: item.brand, model: item.model },
      };
      return ddbDocClient.send(new DeleteCommand(deleteParams));
    });

    await Promise.all(deletePromises);

    console.log(`All models and brand image for "${brand}" deleted.`);
    return { brand, deletedModels: data.Items.map(item => item.model) };

  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteBrand",
      error_message: `DAO error - ${error.message}`,
    });
    throw new Error(`Error deleting brand "${brand}": ${error.message}`);
  }
},

getBrandByLower: async (brandName) => {
  const brandLower = brandName.trim().toLowerCase();
  const params = {
    TableName: "VehicleMaster",
    // If brand_lower is your primary key, drop IndexName and use KeyConditionExpression on brand_lower
    IndexName: "lower_brand-index",
    KeyConditionExpression: "#bl = :bl",
    ExpressionAttributeNames: {
      "#bl": "lower_brand",
    },
    ExpressionAttributeValues: {
      ":bl": brandLower,
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));
  return result.Items[0] || null;
},


getModelByLower: async (modelName) => {
  const modelLower = modelName.trim().toLowerCase();
  const params = {
    TableName: "VehicleMaster",
    // If brand_lower is your primary key, drop IndexName and use KeyConditionExpression on brand_lower
    IndexName: "lower_model-index",
    KeyConditionExpression: "#bl = :bl",
    ExpressionAttributeNames: {
      "#bl": "lower_model",
    },
    ExpressionAttributeValues: {
      ":bl": modelLower,
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));
  return result.Items[0] || null;
},
};


