module.exports.uploadFiles = async function(files, options) {
  if (!files || files.length === 0) {
    return;
  }

  const uploadPromises = files.map(async (file) => {
    try {
      const result = await strapi.upload({
        file: file,
        model: options.model,
        modelId: options.modelId,
        field: options.field
      });
      return { file, result };
    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      return { file, error: { message: error.message, debug: error } };
    }
  });

  const results = await Promise.allSettled(uploadPromises);
  
  const successes = [];
  const errors = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      successes.push(result.value);
    } else {
      errors.push(result.reason);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Failed to upload ${errors.length} files`);
  }

  return successes;
}