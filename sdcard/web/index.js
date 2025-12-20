$(document).ready(function(){

// get the list of songs in the SD card
$.getJSON("/songs", function(data) {
	$.each(data, function(key, fileObj) {
		// fileObj has: {name, size, mapped}
		$('#songs-select').append(new Option(fileObj.name, fileObj.name));
	});
});

// get the current list of mappings
$.getJSON("/mappings", function(data) {
	$.each(data, function(key, val) {
		newElement(val.tagid, val.song);
	});
});

// Load file list
refreshFileList();

// create a new list item
function newElement(tagid, song) {
	
	// <li> element
	var li = document.createElement("li");
	li.setAttribute("tagid", tagid);
	var t = document.createTextNode(tagid + " - " + song);
	li.appendChild(t);
	document.getElementById("myUL").appendChild(li);

	// close button
	var span = document.createElement("SPAN");
	var txt = document.createTextNode("\u00D7");
	span.className = "close";
	span.appendChild(txt);
	li.appendChild(span);
	span.onclick = function() {
		removeElement(this.parentElement);
	}
}

function removeElement(li) {
	
	tagid = li.getAttribute("tagid");
	console.log("Will remove " + tagid);
	$.ajax({
		type: 'POST',
		url: '/delmapping',
		data: JSON.stringify ({tagid: tagid}),
		contentType: "application/json",
		dataType: 'json',
		complete: function(jqXHR, textStatus) {
			if(jqXHR.status == 200) li.remove();
			else alert('Unable to remove mapping: ' + jqXHR.responseJSON["result"]);
		}
	});
}

// Add onclick events to buttons

$("#get-tag-id-button").on("click", function() {
	
	// get current TAG ID
	$.get("/tagid", function(data) {
		$("#tag-id").val(data.tagid);
	});
});


$("#add-mapping-button").on("click", function() {
	
	// get the new tagid and song name
	newtagid = $("#tag-id").val();
	newsong = $("#songs-select").find(":selected").text();
	
	// check if newtagid is valid
	if(newtagid == "") {
		alert("No Tag ID found, did you press the Get Tag ID button with a Tag on the player?");
		return;
	}
		
	
	// check if tagid is already mapped
	found = false;
	$('li').each(function() {
		tagid = this.getAttribute("tagid");
		if(newtagid == tagid) {
			alert("Tag ID already mapped!");
			found = true;
		}
	});
	
	if(!found) {
		
		// save the new mapping
		console.log("Adding " + newtagid + " - " + newsong);
		
		// make the REST call
		$.ajax({
			type: 'POST',
			url: '/addmapping',
			data: JSON.stringify ({tagid: newtagid, song: newsong}),
			contentType: "application/json",
			dataType: 'json',
			complete: function(jqXHR, textStatus) {
				if(jqXHR.status == 200) newElement(newtagid, newsong);
				else alert('Unable to add new: ' + jqXHR.responseJSON["result"]);
			}		
		});
	}
});

// ==================== FILE MANAGEMENT ====================

// Refresh file list
function refreshFileList() {
	$.getJSON("/songs", function(data) {
		$("#files-tbody").empty();

		$.each(data, function(index, fileObj) {
			// Format file size
			const sizeInMB = (fileObj.size / (1024 * 1024)).toFixed(2);
			const sizeDisplay = fileObj.size < 1024*1024 ?
				`${(fileObj.size/1024).toFixed(1)} KB` :
				`${sizeInMB} MB`;

			const status = fileObj.mapped ? "Mapped" : "—";

			const row = `
				<tr data-filename="${fileObj.name}">
					<td class="filename-cell">${fileObj.name}</td>
					<td class="size-cell">${sizeDisplay}</td>
					<td class="status-cell">${status}</td>
					<td class="actions-cell">
						<button class="action-btn download-btn" title="Download">⬇</button>
						<button class="action-btn rename-btn" title="Rename">✎</button>
						<button class="action-btn delete-btn" title="Delete">✕</button>
					</td>
				</tr>
			`;

			$("#files-tbody").append(row);
		});
	});
}

// Upload files sequentially
function uploadFileSequentially(files, index) {
	if (index >= files.length) {
		alert("All files uploaded successfully!");
		refreshFileList();
		// Also refresh songs dropdown
		$('#songs-select').empty();
		$.getJSON("/songs", function(data) {
			$.each(data, function(key, fileObj) {
				$('#songs-select').append(new Option(fileObj.name, fileObj.name));
			});
		});
		document.getElementById('file-input').value = "";
		$("#upload-progress").html("");
		return;
	}

	const file = files[index];
	const formData = new FormData();
	formData.append('data', file);

	$("#upload-progress").html(`Uploading ${file.name} (${index+1}/${files.length})...`);

	$.ajax({
		url: '/upload',
		type: 'POST',
		data: formData,
		processData: false,
		contentType: false,
		xhr: function() {
			const xhr = new window.XMLHttpRequest();
			xhr.upload.addEventListener("progress", function(evt) {
				if (evt.lengthComputable) {
					const percentComplete = (evt.loaded / evt.total) * 100;
					$("#upload-progress").html(
						`Uploading ${file.name}: ${percentComplete.toFixed(1)}%`
					);
				}
			}, false);
			return xhr;
		},
		success: function(response) {
			if (response.result === "OK") {
				uploadFileSequentially(files, index + 1);
			} else {
				alert(`Upload failed for ${file.name}: ${response.message}`);
			}
		},
		error: function() {
			alert(`Upload error for ${file.name}`);
		}
	});
}

// Event handlers
$("#upload-button").on("click", function() {
	const files = document.getElementById('file-input').files;

	if (files.length === 0) {
		alert("Please select files to upload");
		return;
	}

	// Validate all files are MP3
	for (let i = 0; i < files.length; i++) {
		if (!files[i].name.toLowerCase().endsWith('.mp3')) {
			alert(`Invalid file: ${files[i].name}. Only MP3 files allowed.`);
			return;
		}
	}

	uploadFileSequentially(files, 0);
});

$(document).on("click", ".download-btn", function() {
	const filename = $(this).closest('tr').data('filename');
	window.location.href = `/download?file=${encodeURIComponent(filename)}`;
});

$(document).on("click", ".delete-btn", function() {
	const filename = $(this).closest('tr').data('filename');

	if (!confirm(`Delete ${filename}? This cannot be undone.`)) {
		return;
	}

	$.ajax({
		type: 'POST',
		url: '/deletefile',
		data: JSON.stringify({filename: filename}),
		contentType: "application/json",
		dataType: 'json',
		success: function(response) {
			if (response.result === "OK") {
				alert("File deleted successfully");
				refreshFileList();
				// Refresh songs dropdown
				$('#songs-select').empty();
				$.getJSON("/songs", function(data) {
					$.each(data, function(key, fileObj) {
						$('#songs-select').append(new Option(fileObj.name, fileObj.name));
					});
				});
			} else if (response.result === "INUSE") {
				alert("Cannot delete: File is mapped to NFC tag(s). Remove mappings first.");
			} else {
				alert(`Delete failed: ${response.message}`);
			}
		},
		error: function() {
			alert("Error deleting file");
		}
	});
});

$(document).on("click", ".rename-btn", function() {
	const oldFilename = $(this).closest('tr').data('filename');
	const newFilename = prompt(`Rename "${oldFilename}" to:`, oldFilename);

	if (!newFilename || newFilename === oldFilename) {
		return;
	}

	if (!newFilename.toLowerCase().endsWith('.mp3')) {
		alert("Filename must end with .mp3");
		return;
	}

	$.ajax({
		type: 'POST',
		url: '/renamefile',
		data: JSON.stringify({
			oldname: oldFilename,
			newname: newFilename
		}),
		contentType: "application/json",
		dataType: 'json',
		success: function(response) {
			if (response.result === "OK") {
				alert("File renamed successfully");

				if (response.mappingsUpdated) {
					alert("NFC mappings have been updated with the new filename");
					// Refresh mappings list
					$("#myUL").empty();
					$.getJSON("/mappings", function(data) {
						$.each(data, function(key, val) {
							newElement(val.tagid, val.song);
						});
					});
				}

				refreshFileList();
				// Refresh songs dropdown
				$('#songs-select').empty();
				$.getJSON("/songs", function(data) {
					$.each(data, function(key, fileObj) {
						$('#songs-select').append(new Option(fileObj.name, fileObj.name));
					});
				});
			} else if (response.result === "EXISTS") {
				alert("A file with that name already exists");
			} else {
				alert(`Rename failed: ${response.message}`);
			}
		},
		error: function() {
			alert("Error renaming file");
		}
	});
});

// END
});
