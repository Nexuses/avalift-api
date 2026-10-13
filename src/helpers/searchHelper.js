const { applyOrganizationFilter } = require('./organizationFilterHelper');


const buildQueryForCustomer = (
  ride_type,
  status,
  search_string,
  dateFilter,
  lastEvaluatedKey = null,
  limit,
  org_id,
  selected_org,
  rate_type
) => {
  const params = {
    TableName: "Rides",
    IndexName: "all_rides_pk-index",
    KeyConditionExpression: "all_rides_pk = :allRidesValue",
    ExpressionAttributeValues: {
      ":allRidesValue": "All Rides",
    },
    Limit: limit || 10, // ensure a valid limit
  };

  const expressionAttributeNames = {};
  const extraExpressions = [];

  // --- Status Filter ---
  const statusMapping = {
    requested: ["Requested"],
    accepted: ["Accepted"],
    ontheway: ["On-The-Way"],
    started: ["Started", "Reached Customer", "Payment Initiated", "Review-Pending"],
    completed: ["Completed"],
    cancelled: ["Cancelled"],
  };

  if (status && statusMapping[status]) {
    extraExpressions.push(
      `#status IN (${statusMapping[status].map((s, i) => `:status${i}`).join(", ")})`
    );
    statusMapping[status].forEach((s, i) => {
      params.ExpressionAttributeValues[`:status${i}`] = s;
    });
    expressionAttributeNames["#status"] = "status";
  }

 // --- Search String: Dropdown filters + prefix‐name search ---
if (search_string && search_string.trim() !== "") {
  const trimmedSearch = search_string.trim().toLowerCase();
  params.ExpressionAttributeValues[":searchString"] = trimmedSearch;

  // mark the name attrs
  expressionAttributeNames["#lower_customer_name"] = "lower_customer_name";
  expressionAttributeNames["#lower_chauffeur_name"] = "lower_chauffeur_name";

  // dropdown filters (ride_id, customer_id, optional chauffeur_id)
  const dropdownFilters = ["ride_id", "customer_id"];
  if (/^\d+$/.test(trimmedSearch)) {
    dropdownFilters.push("chauffeur_id");
  }
  const dropdownExprs = dropdownFilters.map((field) => {
    expressionAttributeNames[`#${field}`] = field;
    params.ExpressionAttributeValues[`:${field}`] =
      field === "chauffeur_id" ? Number(trimmedSearch) : trimmedSearch;
    return `#${field} = :${field}`;
  });

  // prefix (partial) name‐search
  const nameSearchExpression =
    "(begins_with(#lower_customer_name, :searchString) \
      OR begins_with(#lower_chauffeur_name, :searchString))";

  // combine dropdown OR name
  const combined =
    dropdownExprs.length > 0
      ? `(${dropdownExprs.join(" OR ")} OR ${nameSearchExpression})`
      : nameSearchExpression;

  extraExpressions.push(combined);
}

  // --- Date Filters ---
  if (dateFilter.startDate) {
    extraExpressions.push("#order_date >= :startDate");
    params.ExpressionAttributeValues[":startDate"] = dateFilter.startDate;
    expressionAttributeNames["#order_date"] = "order_date";
  }
  if (dateFilter.endDate) {
    extraExpressions.push("#order_date <= :endDate");
    params.ExpressionAttributeValues[":endDate"] = dateFilter.endDate;
    expressionAttributeNames["#order_date"] = "order_date";
  }

  // --- Ride Type Filter ---
  if (ride_type) {
    extraExpressions.push("#ride_type = :ride_type");
    params.ExpressionAttributeValues[":ride_type"] = ride_type;
    expressionAttributeNames["#ride_type"] = "ride_type";
  }

    // --- Rate Type Filter ---
  if (rate_type) {
    extraExpressions.push("#rate_type = :rate_type");
    params.ExpressionAttributeValues[":rate_type"] = rate_type;
    expressionAttributeNames["#rate_type"] = "rate_type";
  }

  // Combine extra expressions
  if (extraExpressions.length > 0) {
    params.FilterExpression = extraExpressions.join(" AND ");
  }

  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = lastEvaluatedKey;
  }

  console.log("Query Params (Fixed):", params);
  return applyOrganizationFilter(params, org_id, selected_org);
};

const buildQueryForChauffeur = (
  status,
  search_string,
  dateFilter,
  lastEvaluatedKey = null,
  limit
) => {
  const params = {
    TableName: "ChauffeurRides",
    IndexName: "user_type_index",
    KeyConditionExpression: "#user_type = :userTypeValue",
    ExpressionAttributeValues: {
      ":userTypeValue": "Chauffeur",
    },
    Limit: limit || 10,
  };

  const expressionAttributeNames = {
    "#user_type": "user_type"
  };
  const extraExpressions = [];

  // --- Status Filter ---
  if (status) {
    extraExpressions.push("#status = :status");
    params.ExpressionAttributeValues[":status"] = status;
    expressionAttributeNames["#status"] = "status";
  }

   // --- Search String: Dropdown filters + prefix‐name search ---
   if (
    search_string &&
    typeof search_string === "string" &&
    search_string.trim() !== ""
  ) {
    const trimmedRaw = search_string.trim();
    const trimmedSearch = trimmedRaw.toLowerCase();

    // prepare name search
    params.ExpressionAttributeValues[":searchString"] = trimmedSearch;
    expressionAttributeNames["#lower_customer_name"] = "lower_customer_name";
    expressionAttributeNames["#lower_chauffeur_name"] = "lower_chauffeur_name";

    // build dropdown filters: ride_id always, chauffeur_id only if digits
    const dropdownFilters = ["ride_id"];
    if (/^\d+$/.test(trimmedRaw)) {
      dropdownFilters.push("chauffeur_id", "pd_id");
    }

    // map each dropdown field into an equality expression
    const dropdownExpressions = dropdownFilters.map((field) => {
      expressionAttributeNames[`#${field}`] = field;
      params.ExpressionAttributeValues[`:${field}`] =
        field === "chauffeur_id" || field === "pd_id"
          ? Number(trimmedRaw)
          : trimmedRaw;
      return `#${field} = :${field}`;
    });
    const dropdownFilterExpression = `(${dropdownExpressions.join(" OR ")})`;

    // prefix search on names
    const nameSearchExpression = 
      "(begins_with(#lower_customer_name, :searchString) OR begins_with(#lower_chauffeur_name, :searchString))";

    // combine dropdown OR name
    extraExpressions.push(
      dropdownExpressions.length > 0
        ? `(${dropdownFilterExpression} OR ${nameSearchExpression})`
        : nameSearchExpression
    );
  }

  // --- Date Filters ---
  if (dateFilter.startDate) {
    extraExpressions.push("#order_date >= :startDate");
    params.ExpressionAttributeValues[":startDate"] = dateFilter.startDate;
    expressionAttributeNames["#order_date"] = "order_date";
  }
  if (dateFilter.endDate) {
    extraExpressions.push("#order_date <= :endDate");
    params.ExpressionAttributeValues[":endDate"] = dateFilter.endDate;
    expressionAttributeNames["#order_date"] = "order_date";
  }

  // Combine all extra expressions with AND to ensure all conditions must match
  if (extraExpressions.length > 0) {
    params.FilterExpression = extraExpressions.join(" AND ");
  }

  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = lastEvaluatedKey;
  }

  console.log("Query Params for Chauffeur Rides:", params);
  return params;
};



const searchUsers = (users, searchString) => {
  if (!searchString || typeof searchString !== 'string') {
    return users;
  }

  const sanitizedSearchString = searchString.trim().toLowerCase();

  return users.filter(user => {
    return (
      user.id?.toString().toLowerCase().includes(sanitizedSearchString) ||
      user.first_name?.toLowerCase().includes(sanitizedSearchString) ||
      user.last_name?.toLowerCase().includes(sanitizedSearchString) ||
      //user.email_id?.toLowerCase().includes(sanitizedSearchString) ||
      user.mobile_number?.includes(sanitizedSearchString)
    );
  });
};


module.exports = { buildQueryForCustomer, searchUsers, buildQueryForChauffeur };