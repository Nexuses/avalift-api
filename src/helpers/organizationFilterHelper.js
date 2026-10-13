const applyOrganizationFilter = (params, org_id, selectedOrg) => {
  // Determine which organisation id to use for filtering:
  // If the logged-in org_id is "*" and the user has made a specific dropdown selection (selectedOrg !== "*"), use that.
  // Otherwise, if the logged-in org_id is not "*", always use it.
  const orgFilter = (org_id === "*" && selectedOrg && selectedOrg !== "*") ? selectedOrg : org_id;

  // Only add the filter if orgFilter is not the wildcard.
  if (orgFilter !== "*") {
    if (params.FilterExpression) {
      params.FilterExpression += " AND #organisation_id = :org_id";
    } else {
      params.FilterExpression = "#organisation_id = :org_id";
    }
    params.ExpressionAttributeNames = {
      ...params.ExpressionAttributeNames,
      "#organisation_id": "organisation_id",
    };
    params.ExpressionAttributeValues = {
      ...params.ExpressionAttributeValues,
      ":org_id": orgFilter,
    };
  }
  return params;
};
  

module.exports = { applyOrganizationFilter }